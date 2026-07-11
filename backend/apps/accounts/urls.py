from django.urls import path

from .views import MeView, verify_pin

urlpatterns = [
    path("me/", MeView.as_view(), name="me"),
    path("verify-pin/", verify_pin, name="verify-pin"),
]
