from django.db import models as dj_models
from django.utils import timezone
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.catalog.views import BranchScopedViewSet

from .models import Customer, KitchenStatus, Order, OrderItem, Payment, Table
from .serializers import (
    CustomerSerializer,
    OrderItemReadSerializer,
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

    def get_queryset(self):
        qs = super().get_queryset()
        # KDS poll fallback: ?kitchen_status=pending,cooking
        ks = self.request.query_params.get("kitchen_status")
        if ks:
            qs = qs.filter(kitchen_status__in=ks.split(","))
        return qs

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

    @extend_schema(
        request={"type": "object", "properties": {"status": {"type": "string"}}},
        parameters=[OpenApiParameter("kitchen_status", str)],
    )
    @action(detail=True, methods=["post"])
    def kitchen(self, request, pk=None):
        """Advance the whole ticket: set every active item to the given kitchen
        status, then recompute the order roll-up."""
        order = self.get_object()
        new_status = request.data.get("status")
        if new_status not in KitchenStatus.values:
            return Response({"detail": "Invalid status."}, status=status.HTTP_400_BAD_REQUEST)
        for item in order.items.alive().filter(is_void=False):
            item.kitchen_status = new_status
            item.save(update_fields=["kitchen_status", "last_modified"])
        order.recompute_kitchen_status()
        # Re-fetch so the response reflects freshly-saved items (not the cache).
        fresh = self.get_queryset().get(pk=order.pk)
        return Response(self.get_serializer(fresh).data)

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
            order.paid_at = timezone.now()
            order.save()
            if order.table:
                order.table.status = Table.Status.FREE
                order.table.save()
        # Re-fetch so the response includes the freshly-created payments.
        fresh = self.get_queryset().get(pk=order.pk)
        return Response(self.get_serializer(fresh).data)

    @extend_schema(request={"type": "object", "properties": {"table": {"type": "string"}}})
    @action(detail=True, methods=["post"])
    def assign_table(self, request, pk=None):
        """Move an order to a different table (guests shift): free the old table,
        occupy the new one."""
        order = self.get_object()
        table_id = request.data.get("table")
        try:
            new_table = Table.objects.alive().get(id=table_id, branch=order.branch)
        except Table.DoesNotExist:
            return Response({"detail": "Table not found."}, status=status.HTTP_404_NOT_FOUND)
        old = order.table
        if old and old.id != new_table.id and order.status != Order.Status.PAID:
            old.status = Table.Status.FREE
            old.save()
        order.table = new_table
        order.save()
        if order.status in {Order.Status.OPEN, Order.Status.HELD, Order.Status.BILLED}:
            new_table.status = Table.Status.OCCUPIED
            new_table.save()
        return Response(self.get_serializer(order).data)

    @extend_schema(
        request={
            "type": "object",
            "properties": {
                "scope": {"type": "string"},
                "item": {"type": "string"},
                "reason": {"type": "string"},
                "pin": {"type": "string"},
            },
        }
    )
    @action(detail=True, methods=["post"])
    def comp(self, request, pk=None):
        """Complimentary handling (unhappy guest). scope='bill' comps the whole
        order; scope='item' comps a single line. Manager-PIN gated."""
        order = self.get_object()
        user = request.user
        pin = request.data.get("pin", "")
        if not (user.can_authorize_overrides and user.check_manager_pin(pin)):
            return Response(
                {"detail": "Manager PIN required."}, status=status.HTTP_403_FORBIDDEN
            )
        scope = request.data.get("scope", "bill")
        reason = request.data.get("reason", "")
        if scope == "item":
            try:
                line = order.items.alive().get(id=request.data.get("item"))
            except OrderItem.DoesNotExist:
                return Response({"detail": "Item not found."}, status=status.HTTP_404_NOT_FOUND)
            line.is_complimentary = True
            line.comp_reason = reason
            line.save()
        else:
            order.is_complimentary = True
            order.comp_reason = reason
            order.save()
        order.recompute_totals()
        fresh = self.get_queryset().get(pk=order.pk)
        return Response(self.get_serializer(fresh).data)


class OrderItemViewSet(viewsets.ReadOnlyModelViewSet):
    """Read + per-item kitchen status advance."""

    permission_classes = [IsAuthenticated]
    queryset = OrderItem.objects.all().prefetch_related("options", "add_ons")
    serializer_class = OrderItemReadSerializer

    def get_queryset(self):
        qs = self.queryset.alive()
        order = self.request.query_params.get("order")
        return qs.filter(order=order) if order else qs

    @extend_schema(request={"type": "object", "properties": {"status": {"type": "string"}}})
    @action(detail=True, methods=["post"])
    def kitchen(self, request, pk=None):
        """Advance a single line's kitchen status, then recompute the order."""
        item = self.get_object()
        new_status = request.data.get("status")
        if new_status not in KitchenStatus.values:
            return Response({"detail": "Invalid status."}, status=status.HTTP_400_BAD_REQUEST)
        item.kitchen_status = new_status
        item.save(update_fields=["kitchen_status", "last_modified"])
        item.order.recompute_kitchen_status()
        return Response(OrderSerializer(item.order).data)


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
