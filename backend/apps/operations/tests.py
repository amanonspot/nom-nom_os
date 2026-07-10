from decimal import Decimal

from rest_framework.test import APITestCase

from apps.accounts.models import Branch, Restaurant, Role, User
from apps.catalog.models import AddOn, Category, MenuItem, VariationGroup, VariationOption
from apps.operations.models import Order, Table


class OrderFlowTests(APITestCase):
    def setUp(self):
        self.restaurant = Restaurant.objects.create(name="T")
        self.branch = Branch.objects.create(restaurant=self.restaurant, name="B")
        self.user = User.objects.create_user(
            username="mgr", password="pw", role=Role.MANAGER,
            restaurant=self.restaurant, branch=self.branch,
        )
        self.user.set_manager_pin("4321")
        self.user.save()
        self.client.force_authenticate(self.user)

        cat = Category.objects.create(branch=self.branch, name="Mains")
        self.item = MenuItem.objects.create(
            branch=self.branch, category=cat, name="Biryani",
            base_price=Decimal("180"), gst_rate=Decimal("5"), is_veg=False,
        )
        grp = VariationGroup.objects.create(item=self.item, name="Protein")
        self.mutton = VariationOption.objects.create(group=grp, name="Mutton", price_delta=Decimal("80"))
        self.cheese = AddOn.objects.create(branch=self.branch, name="Cheese", price=Decimal("30"))
        self.table = Table.objects.create(branch=self.branch, name="T1")

    def _create_order(self, qty=2):
        payload = {
            "branch": str(self.branch.id),
            "table": str(self.table.id),
            "order_type": "dine_in",
            "items_write": [
                {
                    "menu_item": str(self.item.id),
                    "quantity": qty,
                    "option_ids": [str(self.mutton.id)],
                    "add_on_ids": [str(self.cheese.id)],
                }
            ],
        }
        return self.client.post("/api/ops/orders/", payload, format="json")

    def test_order_pricing_and_gst(self):
        res = self._create_order(qty=2)
        self.assertEqual(res.status_code, 201, res.content)
        data = res.json()
        # unit = 180 + 80 (mutton) + 30 (cheese) = 290; qty 2 => subtotal 580
        self.assertEqual(Decimal(data["subtotal"]), Decimal("580.00"))
        # GST 5% of 580 = 29.00
        self.assertEqual(Decimal(data["tax_total"]), Decimal("29.00"))
        self.assertEqual(Decimal(data["grand_total"]), Decimal("609.00"))
        # Table becomes occupied
        self.table.refresh_from_db()
        self.assertEqual(self.table.status, Table.Status.OCCUPIED)

    def test_void_requires_manager_pin(self):
        order_id = self._create_order().json()["id"]
        bad = self.client.post(f"/api/ops/orders/{order_id}/void/", {"pin": "0000"}, format="json")
        self.assertEqual(bad.status_code, 403)
        ok = self.client.post(f"/api/ops/orders/{order_id}/void/", {"pin": "4321"}, format="json")
        self.assertEqual(ok.status_code, 200)
        self.assertEqual(ok.json()["status"], Order.Status.VOID)
        self.table.refresh_from_db()
        self.assertEqual(self.table.status, Table.Status.FREE)

    def test_settle_split_payment_marks_paid(self):
        order = self._create_order().json()
        oid, total = order["id"], Decimal(order["grand_total"])
        res = self.client.post(
            f"/api/ops/orders/{oid}/settle/",
            [
                {"mode": "cash", "amount": "300.00"},
                {"mode": "upi", "amount": str(total - Decimal("300.00"))},
            ],
            format="json",
        )
        self.assertEqual(res.status_code, 200, res.content)
        self.assertEqual(res.json()["status"], Order.Status.PAID)

    def test_menu_tree_nested(self):
        res = self.client.get(f"/api/catalog/menu/?branch={self.branch.id}")
        self.assertEqual(res.status_code, 200)
        tree = res.json()
        item = tree[0]["items"][0]
        self.assertEqual(item["variation_groups"][0]["options"][0]["name"], "Mutton")
