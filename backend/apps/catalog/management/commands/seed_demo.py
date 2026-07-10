"""Seed a demo restaurant, branch, menu (with variants/add-ons), tables and a
manager user — enough to exercise the full POS flow. Idempotent-ish: clears the
demo restaurant first."""

from decimal import Decimal

from django.core.management.base import BaseCommand

from apps.accounts.models import Branch, Restaurant, Role, User
from apps.catalog.models import (
    AddOn,
    Category,
    MenuItem,
    VariationGroup,
    VariationOption,
)
from apps.operations.models import Table


class Command(BaseCommand):
    help = "Seed demo data for Nom Nom OS."

    def handle(self, *args, **options):
        Restaurant.objects.filter(name="Nom Nom Diner").delete()
        r = Restaurant.objects.create(name="Nom Nom Diner", gstin="29ABCDE1234F1Z5")
        b = Branch.objects.create(restaurant=r, name="MG Road")

        user, _ = User.objects.get_or_create(
            username="manager1",
            defaults={"role": Role.MANAGER, "email": "m1@nomnom.test"},
        )
        user.restaurant = r
        user.branch = b
        user.role = Role.MANAGER
        user.set_password("pass12345")
        user.set_manager_pin("4321")
        user.save()

        # Add-ons
        cheese = AddOn.objects.create(branch=b, name="Extra Cheese", price=Decimal("30"))
        AddOn.objects.create(branch=b, name="Extra Spicy", price=Decimal("0"))

        # Categories
        mains = Category.objects.create(branch=b, name="Mains", sort_order=1)
        drinks = Category.objects.create(branch=b, name="Beverages", sort_order=2)

        # Item with a required Protein variant group
        biryani = MenuItem.objects.create(
            branch=b,
            category=mains,
            name="Biryani",
            base_price=Decimal("180"),
            is_veg=False,
            gst_rate=Decimal("5"),
        )
        protein = VariationGroup.objects.create(item=biryani, name="Protein")
        VariationOption.objects.create(group=protein, name="Chicken", price_delta=Decimal("0"), is_default=True)
        VariationOption.objects.create(group=protein, name="Mutton", price_delta=Decimal("80"))
        VariationOption.objects.create(group=protein, name="Paneer", price_delta=Decimal("-20"))

        # Item with a Size variant group
        cola = MenuItem.objects.create(
            branch=b,
            category=drinks,
            name="Cola",
            base_price=Decimal("40"),
            is_veg=True,
            gst_rate=Decimal("12"),
        )
        size = VariationGroup.objects.create(item=cola, name="Size")
        VariationOption.objects.create(group=size, name="250ml", price_delta=Decimal("0"), is_default=True)
        VariationOption.objects.create(group=size, name="500ml", price_delta=Decimal("20"))

        MenuItem.objects.create(
            branch=b, category=mains, name="Veg Momos (6 pcs)",
            base_price=Decimal("120"), is_veg=True, gst_rate=Decimal("5"),
            pieces_per_plate=6,
        )

        # Tables
        for i in range(1, 7):
            Table.objects.create(branch=b, name=f"T{i}", seats=4, area="Ground Floor")

        self.stdout.write(
            self.style.SUCCESS(
                f"Seeded restaurant={r.id} branch={b.id} "
                f"(login manager1/pass12345, PIN 4321, addon cheese={cheese.id})"
            )
        )
