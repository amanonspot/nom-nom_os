from decimal import Decimal

from django.db import transaction
from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from apps.catalog.models import AddOn, MenuItem, VariationOption

from .models import (
    Customer,
    Order,
    OrderItem,
    OrderItemAddOn,
    OrderItemOption,
    Payment,
    Table,
)


class TableSerializer(serializers.ModelSerializer):
    class Meta:
        model = Table
        fields = ["id", "branch", "name", "seats", "area", "status"]


class CustomerSerializer(serializers.ModelSerializer):
    class Meta:
        model = Customer
        fields = ["id", "branch", "phone", "name"]


class PaymentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Payment
        fields = ["id", "order", "mode", "amount", "tendered", "reference"]


class OrderItemOptionReadSerializer(serializers.ModelSerializer):
    class Meta:
        model = OrderItemOption
        fields = ["id", "option", "name_snapshot", "price_delta"]


class OrderItemAddOnReadSerializer(serializers.ModelSerializer):
    class Meta:
        model = OrderItemAddOn
        fields = ["id", "add_on", "name_snapshot", "price"]


class OrderItemReadSerializer(serializers.ModelSerializer):
    options = OrderItemOptionReadSerializer(many=True, read_only=True)
    add_ons = OrderItemAddOnReadSerializer(many=True, read_only=True)
    line_total = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)
    tax_amount = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)

    class Meta:
        model = OrderItem
        fields = [
            "id",
            "menu_item",
            "name_snapshot",
            "quantity",
            "unit_price",
            "gst_rate",
            "notes",
            "is_void",
            "is_complimentary",
            "kitchen_status",
            "options",
            "add_ons",
            "line_total",
            "tax_amount",
        ]


# --- Write payloads --------------------------------------------------------
class _OrderItemWriteSerializer(serializers.Serializer):
    id = serializers.UUIDField(required=False)
    menu_item = serializers.PrimaryKeyRelatedField(queryset=MenuItem.objects.all())
    quantity = serializers.IntegerField(min_value=1, default=1)
    notes = serializers.CharField(required=False, allow_blank=True, default="")
    is_complimentary = serializers.BooleanField(required=False, default=False)
    option_ids = serializers.PrimaryKeyRelatedField(
        queryset=VariationOption.objects.all(), many=True, required=False, default=list
    )
    add_on_ids = serializers.PrimaryKeyRelatedField(
        queryset=AddOn.objects.all(), many=True, required=False, default=list
    )


class OrderSerializer(serializers.ModelSerializer):
    """Read/write order. On create/replace, prices are snapshotted from the
    catalog and GST totals are computed server-side (authoritative)."""

    # Honor the client-generated UUID so the same id round-trips (offline-first)
    # and re-sending a create is idempotent rather than a duplicate-PK error.
    id = serializers.UUIDField(required=False)
    items = serializers.SerializerMethodField()
    items_write = _OrderItemWriteSerializer(many=True, write_only=True, required=False)
    payments = PaymentSerializer(many=True, read_only=True)
    # Convenience for KDS / the POS floor: the table's name without a 2nd fetch.
    table_name = serializers.CharField(source="table.name", read_only=True, default=None)
    # Guest capture: phone (+ optional name) → get_or_create Customer, link.
    customer_phone = serializers.CharField(write_only=True, required=False, allow_blank=True)
    customer_name = serializers.CharField(write_only=True, required=False, allow_blank=True)

    class Meta:
        model = Order
        fields = [
            "id",
            "branch",
            "table",
            "table_name",
            "customer",
            "customer_phone",
            "customer_name",
            "placed_by",
            "order_type",
            "covers",
            "delivery_address",
            "status",
            "kitchen_status",
            "number",
            "subtotal",
            "tax_total",
            "discount_total",
            "grand_total",
            "is_complimentary",
            "comp_reason",
            "created_at",
            "served_at",
            "paid_at",
            "items",
            "items_write",
            "payments",
        ]
        read_only_fields = [
            "number",
            "subtotal",
            "tax_total",
            "grand_total",
            "kitchen_status",
            "created_at",
            "served_at",
            "paid_at",
        ]

    @extend_schema_field(OrderItemReadSerializer(many=True))
    def get_items(self, obj):
        """Only live lines — soft-deleted (cancelled) items never surface to the
        POS reopen view or the KDS ticket."""
        lines = [i for i in obj.items.all() if not i.is_deleted]
        return OrderItemReadSerializer(lines, many=True).data

    def _resolve_customer(self, validated_data, branch):
        """Pop guest phone/name → get_or_create a Customer and set it on the order."""
        phone = validated_data.pop("customer_phone", "").strip()
        name = validated_data.pop("customer_name", "").strip()
        if not phone:
            return
        customer, created = Customer.objects.get_or_create(
            branch=branch, phone=phone, defaults={"name": name}
        )
        if name and (created or not customer.name):
            customer.name = name
            customer.save()
        validated_data["customer"] = customer

    def _create_line(self, order, line):
        """Create one OrderItem (+ options/add-ons), honoring the client's line
        UUID as the PK so item identity is stable across offline edits."""
        item: MenuItem = line["menu_item"]
        options = line.get("option_ids", [])
        add_ons = line.get("add_on_ids", [])
        unit = item.base_price + sum((o.price_delta for o in options), Decimal("0"))
        unit += sum((a.price for a in add_ons), Decimal("0"))
        oi = OrderItem.objects.create(
            id=line.get("id") or None,
            order=order,
            menu_item=item,
            name_snapshot=item.name,
            quantity=line.get("quantity", 1),
            unit_price=unit,
            gst_rate=item.gst_rate,
            notes=line.get("notes", ""),
            is_complimentary=line.get("is_complimentary", False),
        )
        for opt in options:
            OrderItemOption.objects.create(
                order_item=oi,
                option=opt,
                name_snapshot=opt.name,
                price_delta=opt.price_delta,
            )
        for add in add_ons:
            OrderItemAddOn.objects.create(
                order_item=oi, add_on=add, name_snapshot=add.name, price=add.price
            )
        return oi

    def _build_lines(self, order, items_data):
        for line in items_data:
            self._create_line(order, line)

    def _reconcile_lines(self, order, items_data):
        """Merge the incoming lines into the order's existing ones by client id,
        so cooking progress survives edits:
          - matched id → update quantity/notes/comp only (keep kitchen_status)
          - new id     → create (starts pending → new KDS work)
          - missing    → soft-delete (drops off the KDS ticket)
        """
        existing = {str(oi.id): oi for oi in order.items.alive()}
        seen: set[str] = set()
        for line in items_data:
            lid = str(line.get("id") or "")
            current = existing.get(lid)
            if current is not None:
                current.quantity = line.get("quantity", current.quantity)
                current.notes = line.get("notes", current.notes)
                current.is_complimentary = line.get(
                    "is_complimentary", current.is_complimentary
                )
                current.save(
                    update_fields=[
                        "quantity",
                        "notes",
                        "is_complimentary",
                        "last_modified",
                    ]
                )
                seen.add(lid)
            else:
                created = self._create_line(order, line)
                seen.add(str(created.id))
        for lid, oi in existing.items():
            if lid not in seen:
                oi.soft_delete()

    @transaction.atomic
    def create(self, validated_data):
        items_data = validated_data.pop("items_write", [])
        order_id = validated_data.pop("id", None)
        # Idempotent upsert on the client UUID: a re-sent create updates in place.
        if order_id and Order.objects.filter(id=order_id).exists():
            instance = Order.objects.get(id=order_id)
            return self.update(instance, {**validated_data, "items_write": items_data})
        self._resolve_customer(validated_data, validated_data.get("branch"))
        order = (
            Order.objects.create(id=order_id, **validated_data)
            if order_id
            else Order.objects.create(**validated_data)
        )
        order.assign_number()  # the Bill No
        self._build_lines(order, items_data)
        order.recompute_totals()  # saves (persists number + totals)
        if order.table and order.status == Order.Status.OPEN:
            order.table.status = Table.Status.OCCUPIED
            order.table.save()
        return order

    @transaction.atomic
    def update(self, instance, validated_data):
        items_data = validated_data.pop("items_write", None)
        self._resolve_customer(validated_data, instance.branch)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.assign_number()
        instance.save()
        if items_data is not None:
            # Reconcile per line (by client id) so cooking progress is preserved
            # and only genuinely-new lines re-enter the kitchen as pending.
            self._reconcile_lines(instance, items_data)
        instance.recompute_totals()
        instance.recompute_kitchen_status()
        return instance
