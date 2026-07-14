from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import MeView, UserAdminViewSet, verify_pin

router = DefaultRouter()
router.register("accounts/users", UserAdminViewSet, basename="staff-user")

urlpatterns = [
    path("me/", MeView.as_view(), name="me"),
    path("verify-pin/", verify_pin, name="verify-pin"),
    path("", include(router.urls)),
]
