"""WebSocket URL routing. KDS consumers are added in Phase 2."""

from django.urls import path

websocket_urlpatterns: list[path] = [
    # path("ws/kds/<branch_id>/", KdsConsumer.as_asgi()),  # Phase 2
]
