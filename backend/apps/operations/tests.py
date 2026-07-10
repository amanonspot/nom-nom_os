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

    def test_client_uuid_roundtrips_and_create_is_idempotent(self):
        import uuid

        cid = str(uuid.uuid4())
        payload = {
            "id": cid,
            "branch": str(self.branch.id),
            "order_type": "takeaway",
            "items_write": [{"menu_item": str(self.item.id), "quantity": 1}],
        }
        r1 = self.client.post("/api/ops/orders/", payload, format="json")
        self.assertEqual(r1.status_code, 201, r1.content)
        self.assertEqual(r1.json()["id"], cid)  # server honored the client id
        # Re-sending the same create must upsert, not duplicate or 500.
        r2 = self.client.post("/api/ops/orders/", payload, format="json")
        self.assertIn(r2.status_code, (200, 201))
        self.assertEqual(Order.objects.filter(id=cid).count(), 1)

    def test_menu_tree_nested(self):
        res = self.client.get(f"/api/catalog/menu/?branch={self.branch.id}")
        self.assertEqual(res.status_code, 200)
        tree = res.json()
        item = tree[0]["items"][0]
        self.assertEqual(item["variation_groups"][0]["options"][0]["name"], "Mutton")

    def _two_item_order(self):
        payload = {
            "branch": str(self.branch.id),
            "order_type": "takeaway",
            "items_write": [
                {"menu_item": str(self.item.id), "quantity": 1},
                {"menu_item": str(self.item.id), "quantity": 2},
            ],
        }
        return self.client.post("/api/ops/orders/", payload, format="json").json()

    def test_kitchen_rollup_per_ticket(self):
        order = self._two_item_order()
        self.assertEqual(order["kitchen_status"], "pending")
        # Bump the whole ticket to cooking.
        res = self.client.post(f"/api/ops/orders/{order['id']}/kitchen/", {"status": "cooking"}, format="json")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["kitchen_status"], "cooking")
        for item in res.json()["items"]:
            self.assertEqual(item["kitchen_status"], "cooking")

    def test_kitchen_rollup_per_item_is_least_advanced(self):
        order = self._two_item_order()
        item_ids = [i["id"] for i in order["items"]]
        # Advance only the first item to ready; order stays 'pending' (other item pending).
        r1 = self.client.post(f"/api/ops/order-items/{item_ids[0]}/kitchen/", {"status": "ready"}, format="json")
        self.assertEqual(r1.status_code, 200)
        self.assertEqual(r1.json()["kitchen_status"], "pending")
        # Advance the second item to ready too; order rolls up to 'ready'.
        r2 = self.client.post(f"/api/ops/order-items/{item_ids[1]}/kitchen/", {"status": "ready"}, format="json")
        self.assertEqual(r2.json()["kitchen_status"], "ready")

    def test_kitchen_rejects_bad_status(self):
        order = self._two_item_order()
        res = self.client.post(f"/api/ops/orders/{order['id']}/kitchen/", {"status": "burnt"}, format="json")
        self.assertEqual(res.status_code, 400)

    # --- POS overhaul: bill no, guest, change table, comp, calculator ------
    def test_bill_number_is_sequential_per_branch(self):
        n1 = self._create_order().json()["number"]
        n2 = self._create_order().json()["number"]
        self.assertEqual(n2, n1 + 1)

    def test_guest_phone_creates_and_links_customer(self):
        from apps.operations.models import Customer

        payload = {
            "branch": str(self.branch.id),
            "order_type": "takeaway",
            "customer_phone": "9998887777",
            "customer_name": "Asha",
            "items_write": [{"menu_item": str(self.item.id), "quantity": 1}],
        }
        res = self.client.post("/api/ops/orders/", payload, format="json")
        self.assertEqual(res.status_code, 201, res.content)
        cust = Customer.objects.get(branch=self.branch, phone="9998887777")
        self.assertEqual(cust.name, "Asha")
        self.assertEqual(res.json()["customer"], str(cust.id))

    def test_assign_table_moves_and_frees(self):
        t2 = Table.objects.create(branch=self.branch, name="T2")
        order = self._create_order().json()  # occupies self.table (T1)
        self.table.refresh_from_db()
        self.assertEqual(self.table.status, Table.Status.OCCUPIED)
        res = self.client.post(
            f"/api/ops/orders/{order['id']}/assign_table/", {"table": str(t2.id)}, format="json"
        )
        self.assertEqual(res.status_code, 200, res.content)
        self.table.refresh_from_db(); t2.refresh_from_db()
        self.assertEqual(self.table.status, Table.Status.FREE)   # old freed
        self.assertEqual(t2.status, Table.Status.OCCUPIED)       # new occupied

    def test_comp_item_and_bill_require_pin_and_zero_totals(self):
        order = self._create_order(qty=2).json()  # 2× (180+80+30)=580 + 5% = 609
        oid = order["id"]
        # Wrong PIN rejected.
        bad = self.client.post(f"/api/ops/orders/{oid}/comp/", {"scope": "bill", "pin": "0000"}, format="json")
        self.assertEqual(bad.status_code, 403)
        # Comp the single line → subtotal drops to 0 (only line comped).
        item_id = order["items"][0]["id"]
        r_item = self.client.post(
            f"/api/ops/orders/{oid}/comp/",
            {"scope": "item", "item": item_id, "reason": "cold food", "pin": "4321"},
            format="json",
        )
        self.assertEqual(r_item.status_code, 200, r_item.content)
        self.assertEqual(Decimal(r_item.json()["subtotal"]), Decimal("0.00"))
        # Comp the whole bill → grand_total 0.
        r_bill = self.client.post(
            f"/api/ops/orders/{oid}/comp/", {"scope": "bill", "reason": "vip", "pin": "4321"}, format="json"
        )
        self.assertEqual(Decimal(r_bill.json()["grand_total"]), Decimal("0.00"))

    def test_settle_records_tendered_and_paid_at(self):
        order = self._create_order().json()
        oid, total = order["id"], order["grand_total"]
        res = self.client.post(
            f"/api/ops/orders/{oid}/settle/",
            [{"mode": "cash", "amount": total, "tendered": "1000.00"}],
            format="json",
        )
        self.assertEqual(res.status_code, 200, res.content)
        self.assertEqual(res.json()["status"], Order.Status.PAID)
        self.assertIsNotNone(res.json()["paid_at"])
        self.assertEqual(res.json()["payments"][0]["tendered"], "1000.00")
