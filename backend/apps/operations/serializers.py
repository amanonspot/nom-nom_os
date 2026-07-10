from decimal import Decimal

from django.db import transaction
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
        fields = ["id", "order", "mode", "amount", "reference"]


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
    items = OrderItemReadSerializer(many=True, read_only=True)
    items_write = _OrderItemWriteSerializer(many=True, write_only=True, required=False)
    payments = PaymentSerializer(many=True, read_only=True)

    class Meta:
        model = Order
        fields = [
            "id",
            "branch",
            "table",
            "customer",
            "placed_by",
            "order_type",
            "status",
            "number",
            "subtotal",
            "tax_total",
            "discount_total",
            "grand_total",
            "items",
            "items_write",
            "payments",
        ]
        read_only_fields = ["number", "subtotal", "tax_total", "grand_total"]

    def _build_lines(self, order, items_data):
        for line in items_data:
            item: MenuItem = line["menu_item"]
            options = line.get("option_ids", [])
            add_ons = line.get("add_on_ids", [])
            unit = item.base_price + sum((o.price_delta for o in options), Decimal("0"))
            unit += sum((a.price for a in add_ons), Decimal("0"))
            oi = OrderItem.objects.create(
                order=order,
                menu_item=item,
                name_snapshot=item.name,
                quantity=line.get("quantity", 1),
                unit_price=unit,
                gst_rate=item.gst_rate,
                notes=line.get("notes", ""),
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

    @transaction.atomic
    def create(self, validated_data):
        items_data = validated_data.pop("items_write", [])
        order_id = validated_data.pop("id", None)
        # Idempotent upsert on the client UUID: a re-sent create updates in place.
        if order_id and Order.objects.filter(id=order_id).exists():
            instance = Order.objects.get(id=order_id)
            return self.update(instance, {**validated_data, "items_write": items_data})
        order = Order.objects.create(id=order_id, **validated_data) if order_id else Order.objects.create(**validated_data)
        self._build_lines(order, items_data)
        order.recompute_totals()
        if order.table and order.status == Order.Status.OPEN:
            order.table.status = Table.Status.OCCUPIED
            order.table.save()
        return order

    @transaction.atomic
    def update(self, instance, validated_data):
        items_data = validated_data.pop("items_write", None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        if items_data is not None:
            instance.items.all().delete()  # replace lines wholesale
            self._build_lines(instance, items_data)
        instance.recompute_totals()
        return instance
