from decimal import Decimal

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.test import TestCase

from apps.accounts.models import Branch, Restaurant
from apps.catalog.models import Category, MenuItem
from apps.operations.models import Order, OrderItem


class BroadcastTests(TestCase):
    def test_order_save_broadcasts_to_branch_group(self):
        restaurant = Restaurant.objects.create(name="R")
        branch = Branch.objects.create(restaurant=restaurant, name="B")
        cat = Category.objects.create(branch=branch, name="Mains")
        item = MenuItem.objects.create(
            branch=branch, category=cat, name="Biryani",
            base_price=Decimal("100"), gst_rate=Decimal("5"),
        )

        layer = get_channel_layer()
        channel = async_to_sync(layer.new_channel)()
        async_to_sync(layer.group_add)(f"branch_{branch.id}", channel)

        # on_commit fires the broadcast; execute=True runs it inside the test.
        with self.captureOnCommitCallbacks(execute=True):
            order = Order.objects.create(branch=branch)
            OrderItem.objects.create(
                order=order, menu_item=item, name_snapshot="Biryani",
                quantity=1, unit_price=Decimal("100"), gst_rate=Decimal("5"),
            )
            order.recompute_totals()

        msg = async_to_sync(layer.receive)(channel)
        self.assertEqual(msg["type"], "order.event")
        self.assertEqual(msg["payload"]["event"], "order.new")
        self.assertEqual(msg["payload"]["order"]["id"], str(order.id))
