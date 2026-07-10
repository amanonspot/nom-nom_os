"""WebSocket URL routing for the KDS."""

from django.urls import path

from .consumers import KdsConsumer

websocket_urlpatterns = [
    path("ws/kds/<branch_id>/", KdsConsumer.as_asgi()),
]
