from rest_framework.routers import DefaultRouter

from .views import (
    CustomerViewSet,
    OrderItemViewSet,
    OrderViewSet,
    PaymentViewSet,
    TableViewSet,
)

router = DefaultRouter()
router.register("tables", TableViewSet, basename="table")
router.register("customers", CustomerViewSet, basename="customer")
router.register("orders", OrderViewSet, basename="order")
router.register("order-items", OrderItemViewSet, basename="orderitem")
router.register("payments", PaymentViewSet, basename="payment")

urlpatterns = router.urls
