import uuid
from decimal import Decimal

from django.utils import timezone
from rest_framework.test import APITestCase

from apps.accounts.models import Branch, Restaurant, Role, User
from apps.catalog.models import Category, MenuItem
from apps.operations.models import Order, Table


class SyncApiTests(APITestCase):
    def setUp(self):
        self.restaurant = Restaurant.objects.create(name="R")
        self.branch = Branch.objects.create(restaurant=self.restaurant, name="B")
        self.user = User.objects.create_user(
            username="mgr", password="pw", role=Role.MANAGER,
            restaurant=self.restaurant, branch=self.branch,
        )
        self.client.force_authenticate(self.user)
        cat = Category.objects.create(branch=self.branch, name="Mains")
        self.item = MenuItem.objects.create(
            branch=self.branch, category=cat, name="Biryani",
            base_price=Decimal("180"), gst_rate=Decimal("5"),
        )
        self.table = Table.objects.create(branch=self.branch, name="T1")

    def _order_payload(self):
        return {
            "id": str(uuid.uuid4()),
            "branch": str(self.branch.id),
            "table": str(self.table.id),
            "order_type": "dine_in",
            "items_write": [{"menu_item": str(self.item.id), "quantity": 2}],
        }

    def test_push_batch_upserts_orders(self):
        payload = self._order_payload()
        res = self.client.post("/api/sync/push/", {"orders": [payload]}, format="json")
        self.assertEqual(res.status_code, 200, res.content)
        ack = res.json()["acks"][0]
        self.assertEqual(ack["status"], "ok")
        self.assertEqual(ack["id"], payload["id"])
        o = Order.objects.get(id=payload["id"])
        self.assertEqual(o.grand_total, Decimal("378.00"))  # 360 + 5% GST

    def test_push_is_idempotent(self):
        payload = self._order_payload()
        self.client.post("/api/sync/push/", {"orders": [payload]}, format="json")
        self.client.post("/api/sync/push/", {"orders": [payload]}, format="json")
        self.assertEqual(Order.objects.filter(id=payload["id"]).count(), 1)

    def test_pull_returns_deltas_and_respects_since(self):
        # A device that pushed an order...
        payload = self._order_payload()
        self.client.post("/api/sync/push/", {"orders": [payload]}, format="json")

        # ...another device pulls from the beginning and sees it + the catalog.
        full = self.client.get(f"/api/sync/pull/?branch={self.branch.id}").json()
        order_ids = [o["id"] for o in full["orders"]]
        self.assertIn(payload["id"], order_ids)
        self.assertTrue(any(i["name"] == "Biryani" for i in full["items"]))
        self.assertEqual(len(full["tables"]), 1)

        # A pull with since=now returns no orders (nothing changed after).
        cutoff = timezone.now().isoformat()
        empty = self.client.get(
            f"/api/sync/pull/?branch={self.branch.id}&since={cutoff}"
        ).json()
        self.assertEqual(empty["orders"], [])

    def test_pull_includes_tombstones(self):
        t = Table.objects.create(branch=self.branch, name="T2")
        since = (timezone.now()).isoformat()
        t.soft_delete()
        data = self.client.get(
            f"/api/sync/pull/?branch={self.branch.id}&since={since}"
        ).json()
        tomb = [x for x in data["tables"] if x["id"] == str(t.id)]
        self.assertEqual(len(tomb), 1)
