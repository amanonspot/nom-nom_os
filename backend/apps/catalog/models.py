"""Menu catalog: categories, items, variant groups/options, add-ons.

Pricing model: an order line's price is the item's ``base_price`` plus the
``price_delta`` of each chosen variant option plus each selected add-on's price,
times quantity. Variant groups are required, single-select choices (e.g. Size,
Protein); add-ons are optional, multi-select extras (e.g. Extra cheese).
"""

from decimal import Decimal

from django.core.validators import MinValueValidator
from django.db import models

from apps.accounts.models import Branch
from apps.common.models import SyncableModel


class Category(SyncableModel):
    branch = models.ForeignKey(Branch, related_name="categories", on_delete=models.CASCADE)
    name = models.CharField(max_length=120)
    sort_order = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True)

    class Meta(SyncableModel.Meta):
        ordering = ["sort_order", "name"]
        verbose_name_plural = "categories"

    def __str__(self):
        return self.name


class MenuItem(SyncableModel):
    branch = models.ForeignKey(Branch, related_name="menu_items", on_delete=models.CASCADE)
    category = models.ForeignKey(Category, related_name="items", on_delete=models.CASCADE)
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    base_price = models.DecimalField(
        max_digits=10, decimal_places=2, validators=[MinValueValidator(Decimal("0"))]
    )
    is_veg = models.BooleanField(default=True)
    # Number of pieces / quantity that make up one plate (e.g. 6 momos).
    pieces_per_plate = models.PositiveIntegerField(default=1)
    # GST percentage for this item (India: commonly 5% for restaurant service).
    gst_rate = models.DecimalField(max_digits=5, decimal_places=2, default=5)
    is_available = models.BooleanField(default=True)
    sort_order = models.PositiveIntegerField(default=0)

    class Meta(SyncableModel.Meta):
        ordering = ["sort_order", "name"]

    def __str__(self):
        return self.name


class VariationGroup(SyncableModel):
    """A required single-select group on an item, e.g. Size or Protein."""

    item = models.ForeignKey(MenuItem, related_name="variation_groups", on_delete=models.CASCADE)
    name = models.CharField(max_length=120)
    is_required = models.BooleanField(default=True)
    sort_order = models.PositiveIntegerField(default=0)

    class Meta(SyncableModel.Meta):
        ordering = ["sort_order", "name"]

    def __str__(self):
        return f"{self.item.name} · {self.name}"


class VariationOption(SyncableModel):
    """An option within a group, e.g. 500ml (+₹40) or Paneer (+₹0)."""

    group = models.ForeignKey(VariationGroup, related_name="options", on_delete=models.CASCADE)
    name = models.CharField(max_length=120)
    price_delta = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    is_default = models.BooleanField(default=False)
    sort_order = models.PositiveIntegerField(default=0)

    class Meta(SyncableModel.Meta):
        ordering = ["sort_order", "name"]

    def __str__(self):
        return self.name


class AddOn(SyncableModel):
    """An optional extra, offered per branch and attachable to any item order."""

    branch = models.ForeignKey(Branch, related_name="add_ons", on_delete=models.CASCADE)
    name = models.CharField(max_length=120)
    price = models.DecimalField(
        max_digits=10, decimal_places=2, validators=[MinValueValidator(Decimal("0"))]
    )
    is_active = models.BooleanField(default=True)

    class Meta(SyncableModel.Meta):
        ordering = ["name"]

    def __str__(self):
        return self.name
