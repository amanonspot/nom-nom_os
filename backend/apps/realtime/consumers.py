"""KDS WebSocket consumer — one group per branch (`branch_<id>`).

Clients authenticate with a JWT in the `?token=` query param (browsers can't set
Authorization headers on a WebSocket). On connect the consumer joins the branch
group and thereafter forwards every `order.event` broadcast to the socket.
"""

from urllib.parse import parse_qs

from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncJsonWebsocketConsumer


@database_sync_to_async
def _user_from_token(raw_token):
    from django.contrib.auth import get_user_model
    from rest_framework_simplejwt.tokens import AccessToken

    try:
        token = AccessToken(raw_token)
        return get_user_model().objects.get(id=token["user_id"])
    except Exception:
        return None


class KdsConsumer(AsyncJsonWebsocketConsumer):
    async def connect(self):
        self.branch_id = self.scope["url_route"]["kwargs"]["branch_id"]
        params = parse_qs(self.scope["query_string"].decode())
        token = (params.get("token") or [None])[0]
        user = await _user_from_token(token)
        if user is None:
            await self.close(code=4001)
            return
        self.group = f"branch_{self.branch_id}"
        await self.channel_layer.group_add(self.group, self.channel_name)
        await self.accept()

    async def disconnect(self, code):
        if hasattr(self, "group"):
            await self.channel_layer.group_discard(self.group, self.channel_name)

    async def order_event(self, event):
        """Group message handler (type: "order.event")."""
        await self.send_json(event["payload"])
