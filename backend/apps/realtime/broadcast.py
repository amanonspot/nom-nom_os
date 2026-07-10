"""Push order changes to a branch's KDS/POS WebSocket group."""

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer


def broadcast_order(order, event="order.new"):
    layer = get_channel_layer()
    if layer is None:
        return
    # Imported lazily to avoid app-loading cycles.
    from apps.operations.serializers import OrderSerializer

    payload = {"event": event, "order": OrderSerializer(order).data}
    async_to_sync(layer.group_send)(
        f"branch_{order.branch_id}",
        {"type": "order.event", "payload": payload},
    )
