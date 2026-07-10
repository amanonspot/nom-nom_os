"""Operational entities: tables, customers, orders, order lines, payments.

Orders are created on a device (offline-capable) with a client-generated UUID,
so the same object round-trips through push/pull without id remapping. Money is
stored as Decimal; a line's total is captured as a snapshot (``unit_price`` +
``line_total``) so historical bills never change if the menu is later edited.
"""

from decimal import Decimal

from django.db import models
from django.utils import timezone

from apps.accounts.models import Branch, User
from apps.catalog.models import AddOn, MenuItem, VariationOption
from apps.common.models import SyncableModel


class Table(SyncableModel):
    class Status(models.TextChoices):
        FREE = "free", "Free"
        OCCUPIED = "occupied", "Occupied"

    branch = models.ForeignKey(Branch, related_name="tables", on_delete=models.CASCADE)
    name = models.CharField(max_length=40)
    seats = models.PositiveIntegerField(default=4)
    area = models.CharField(max_length=80, blank=True)
    status = models.CharField(max_length=12, choices=Status.choices, default=Status.FREE)

    class Meta(SyncableModel.Meta):
        ordering = ["area", "name"]

    def __str__(self):
        return self.name


class Customer(SyncableModel):
    branch = models.ForeignKey(Branch, related_name="customers", on_delete=models.CASCADE)
    phone = models.CharField(max_length=20, db_index=True)
    name = models.CharField(max_length=120, blank=True)

    class Meta(SyncableModel.Meta):
        ordering = ["name", "phone"]
        constraints = [
            models.UniqueConstraint(fields=["branch", "phone"], name="uniq_branch_phone")
        ]

    def __str__(self):
        return f"{self.name or 'Guest'} ({self.phone})"


class KitchenStatus(models.TextChoices):
    PENDING = "pending", "Pending"
    COOKING = "cooking", "Cooking"
    READY = "ready", "Ready"
    SERVED = "served", "Served"


# Progression order for the KDS roll-up (least → most advanced).
KITCHEN_RANK = {
    KitchenStatus.PENDING: 0,
    KitchenStatus.COOKING: 1,
    KitchenStatus.READY: 2,
    KitchenStatus.SERVED: 3,
}


class Order(SyncableModel):
    class Status(models.TextChoices):
        OPEN = "open", "Open"
        HELD = "held", "Held"
        BILLED = "billed", "Billed"
        PAID = "paid", "Paid"
        VOID = "void", "Void"

    class OrderType(models.TextChoices):
        DINE_IN = "dine_in", "Dine-in"
        TAKEAWAY = "takeaway", "Pick up"
        DELIVERY = "delivery", "Delivery"
        QR = "qr", "QR self-order"

    branch = models.ForeignKey(Branch, related_name="orders", on_delete=models.CASCADE)
    table = models.ForeignKey(
        Table, related_name="orders", on_delete=models.SET_NULL, null=True, blank=True
    )
    customer = models.ForeignKey(
        Customer, related_name="orders", on_delete=models.SET_NULL, null=True, blank=True
    )
    placed_by = models.ForeignKey(
        User, related_name="orders", on_delete=models.SET_NULL, null=True, blank=True
    )
    order_type = models.CharField(
        max_length=12, choices=OrderType.choices, default=OrderType.DINE_IN
    )
    # Party size (guests seated). Delivery: the drop address.
    covers = models.PositiveIntegerField(default=1)
    delivery_address = models.TextField(blank=True)
    status = models.CharField(max_length=12, choices=Status.choices, default=Status.OPEN)
    # Kitchen (KDS) status — a roll-up of the order's items; see recompute_kitchen_status.
    kitchen_status = models.CharField(
        max_length=12, choices=KitchenStatus.choices, default=KitchenStatus.PENDING
    )
    # Human-friendly per-branch sequence (the Bill No), assigned server-side.
    number = models.PositiveIntegerField(null=True, blank=True)

    # Monetary snapshot, recomputed on save from live lines.
    subtotal = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    tax_total = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    discount_total = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    grand_total = models.DecimalField(max_digits=10, decimal_places=2, default=0)

    # Whole-bill complimentary (unhappy-guest handling); zeroes the total.
    is_complimentary = models.BooleanField(default=False)
    comp_reason = models.CharField(max_length=200, blank=True)

    # Turnaround timeline: created_at = punched; then served, then paid.
    served_at = models.DateTimeField(null=True, blank=True)
    paid_at = models.DateTimeField(null=True, blank=True)

    voided_by = models.ForeignKey(
        User,
        related_name="voided_orders",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )

    def recompute_totals(self, save=True):
        subtotal = Decimal("0")
        tax = Decimal("0")
        # .filter() bypasses any prefetch cache so we see freshly-saved lines.
        for line in self.items.filter(is_deleted=False, is_void=False):
            if line.is_complimentary:
                continue  # comped lines are on the house — excluded from the bill
            subtotal += line.line_total
            tax += line.tax_amount
        self.subtotal = subtotal
        self.tax_total = tax
        if self.is_complimentary:
            self.grand_total = Decimal("0")  # whole bill on the house
        else:
            self.grand_total = subtotal + tax - self.discount_total
        if save:
            self.save()
        return self.grand_total

    def assign_number(self):
        """Assign the per-branch sequential Bill No on first persist."""
        if self.number:
            return self.number
        last = (
            Order.objects.filter(branch=self.branch, number__isnull=False)
            .order_by("-number")
            .values_list("number", flat=True)
            .first()
        )
        self.number = (last or 0) + 1
        return self.number

    def recompute_kitchen_status(self, save=True):
        """Order status = the least-advanced active item (per-order roll-up of
        per-item statuses). No active items → pending."""
        # .filter() bypasses any prefetch cache so we see freshly-saved items.
        ranks = [
            KITCHEN_RANK[KitchenStatus(item.kitchen_status)]
            for item in self.items.filter(is_deleted=False, is_void=False)
        ]
        rank = min(ranks) if ranks else 0
        self.kitchen_status = {v: k for k, v in KITCHEN_RANK.items()}[rank]
        fields = ["kitchen_status", "last_modified"]
        # Stamp the first time the whole ticket is ready (for turnaround timing).
        if self.kitchen_status == KitchenStatus.READY and self.served_at is None:
            self.served_at = timezone.now()
            fields.append("served_at")
        if save:
            super().save(update_fields=fields)
        return self.kitchen_status

    def __str__(self):
        return f"Order {self.number or self.id}"


class OrderItem(SyncableModel):
    order = models.ForeignKey(Order, related_name="items", on_delete=models.CASCADE)
    menu_item = models.ForeignKey(
        MenuItem, related_name="order_items", on_delete=models.PROTECT
    )
    name_snapshot = models.CharField(max_length=200)
    quantity = models.PositiveIntegerField(default=1)
    # Snapshot pricing so past bills are immutable.
    unit_price = models.DecimalField(max_digits=10, decimal_places=2)
    gst_rate = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    notes = models.CharField(max_length=200, blank=True)
    is_void = models.BooleanField(default=False)
    # Per-line complimentary (comp a single dish for an unhappy guest).
    is_complimentary = models.BooleanField(default=False)
    comp_reason = models.CharField(max_length=200, blank=True)
    kitchen_status = models.CharField(
        max_length=12, choices=KitchenStatus.choices, default=KitchenStatus.PENDING
    )

    @property
    def line_total(self) -> Decimal:
        return (self.unit_price * self.quantity).quantize(Decimal("0.01"))

    @property
    def tax_amount(self) -> Decimal:
        return (self.line_total * self.gst_rate / Decimal("100")).quantize(Decimal("0.01"))

    def __str__(self):
        return f"{self.quantity}× {self.name_snapshot}"


class OrderItemOption(SyncableModel):
    """A chosen variation option on a line (snapshotting name + delta)."""

    order_item = models.ForeignKey(
        OrderItem, related_name="options", on_delete=models.CASCADE
    )
    option = models.ForeignKey(
        VariationOption, related_name="order_selections", on_delete=models.PROTECT
    )
    name_snapshot = models.CharField(max_length=160)
    price_delta = models.DecimalField(max_digits=10, decimal_places=2, default=0)


class OrderItemAddOn(SyncableModel):
    """A selected add-on on a line (snapshotting name + price)."""

    order_item = models.ForeignKey(
        OrderItem, related_name="add_ons", on_delete=models.CASCADE
    )
    add_on = models.ForeignKey(
        AddOn, related_name="order_selections", on_delete=models.PROTECT
    )
    name_snapshot = models.CharField(max_length=160)
    price = models.DecimalField(max_digits=10, decimal_places=2, default=0)


class Payment(SyncableModel):
    class Mode(models.TextChoices):
        CASH = "cash", "Cash"
        CARD = "card", "Card"
        UPI = "upi", "UPI"

    order = models.ForeignKey(Order, related_name="payments", on_delete=models.CASCADE)
    mode = models.CharField(max_length=8, choices=Mode.choices)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    # Cash tendered by the guest (amount handed over); change = tendered - amount.
    tendered = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    reference = models.CharField(max_length=120, blank=True)

    def __str__(self):
        return f"{self.mode} {self.amount}"
