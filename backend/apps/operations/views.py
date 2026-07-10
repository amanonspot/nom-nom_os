from django.db import models as dj_models
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.catalog.views import BranchScopedViewSet

from .models import Customer, Order, Payment, Table
from .serializers import (
    CustomerSerializer,
    OrderSerializer,
    PaymentSerializer,
    TableSerializer,
)


class TableViewSet(BranchScopedViewSet):
    queryset = Table.objects.all()
    serializer_class = TableSerializer


class CustomerViewSet(BranchScopedViewSet):
    queryset = Customer.objects.all()
    serializer_class = CustomerSerializer

    @extend_schema(parameters=[OpenApiParameter("phone", str)])
    @action(detail=False, methods=["get"])
    def by_phone(self, request):
        phone = request.query_params.get("phone", "")
        qs = self.get_queryset().filter(phone=phone)
        return Response(self.get_serializer(qs, many=True).data)


class OrderViewSet(BranchScopedViewSet):
    queryset = Order.objects.all().prefetch_related(
        "items__options", "items__add_ons", "payments"
    )
    serializer_class = OrderSerializer

    @extend_schema(request={"type": "object", "properties": {"pin": {"type": "string"}}})
    @action(detail=True, methods=["post"])
    def void(self, request, pk=None):
        """Void an order; requires a valid manager PIN from a privileged user."""
        order = self.get_object()
        pin = request.data.get("pin", "")
        user = request.user
        if not (user.can_authorize_overrides and user.check_manager_pin(pin)):
            return Response(
                {"detail": "Manager PIN required."}, status=status.HTTP_403_FORBIDDEN
            )
        order.status = Order.Status.VOID
        order.voided_by = user
        order.save()
        if order.table:
            order.table.status = Table.Status.FREE
            order.table.save()
        return Response(self.get_serializer(order).data)

    @extend_schema(request=PaymentSerializer(many=True))
    @action(detail=True, methods=["post"])
    def settle(self, request, pk=None):
        """Attach one or more payments and mark the order paid when covered."""
        order = self.get_object()
        payments = request.data if isinstance(request.data, list) else [request.data]
        for p in payments:
            ser = PaymentSerializer(data={**p, "order": str(order.id)})
            ser.is_valid(raise_exception=True)
            ser.save()
        paid = order.payments.alive().aggregate(t=dj_models.Sum("amount"))["t"] or 0
        if paid >= order.grand_total:
            order.status = Order.Status.PAID
            order.save()
            if order.table:
                order.table.status = Table.Status.FREE
                order.table.save()
        return Response(self.get_serializer(order).data)


class PaymentViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    queryset = Payment.objects.all()
    serializer_class = PaymentSerializer

    def get_queryset(self):
        qs = self.queryset.alive()
        order = self.request.query_params.get("order")
        return qs.filter(order=order) if order else qs

    def perform_destroy(self, instance):
        instance.soft_delete()
