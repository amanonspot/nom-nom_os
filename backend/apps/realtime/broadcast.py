"""Push order changes to a branch's KDS/POS WebSocket group."""

import json

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from rest_framework.renderers import JSONRenderer


def broadcast_order(order, event="order.new"):
    layer = get_channel_layer()
    if layer is None:
        return
    # Imported lazily to avoid app-loading cycles.
    from apps.operations.serializers import OrderSerializer

    # Round-trip through DRF's renderer so UUID/Decimal/datetime become plain
    # JSON primitives — the consumer's json.dumps can't encode them otherwise.
    order_data = json.loads(JSONRenderer().render(OrderSerializer(order).data))
    payload = {"event": event, "order": order_data}
    async_to_sync(layer.group_send)(
        f"branch_{order.branch_id}",
        {"type": "order.event", "payload": payload},
    )
