"""Generalized offline-first sync: batched push + delta pull.

`push` upserts a batch of orders (reusing the idempotent client-UUID upsert in
OrderSerializer). `pull` returns every syncable row changed since a timestamp —
including soft-delete tombstones — so a reconnecting device converges to the
cloud state via last-write-wins.
"""

from django.utils import timezone
from django.utils.dateparse import parse_datetime
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.catalog.models import (
    AddOn,
    Category,
    MenuItem,
    VariationGroup,
    VariationOption,
)
from apps.catalog.serializers import (
    AddOnSerializer,
    CategorySerializer,
    MenuItemSerializer,
    VariationGroupSerializer,
    VariationOptionSerializer,
)
from apps.operations.models import Customer, Order, Table
from apps.operations.serializers import (
    CustomerSerializer,
    OrderSerializer,
    TableSerializer,
)


@extend_schema(
    operation_id="sync_push",
    request={"type": "object", "properties": {"orders": {"type": "array"}}},
    responses={"type": "object"},
)
@api_view(["POST"])
@permission_classes([IsAuthenticated])
def sync_push(request):
    """Upsert a batch of orders in order; return per-order acks."""
    orders = request.data.get("orders", [])
    acks = []
    for payload in orders:
        ser = OrderSerializer(data=payload)
        if ser.is_valid():
            order = ser.save()
            acks.append(
                {"id": str(order.id), "status": "ok", "last_modified": order.last_modified}
            )
        else:
            acks.append({"id": payload.get("id"), "status": "error", "errors": ser.errors})
    return Response({"acks": acks, "server_time": timezone.now()})


# (model, serializer, response key) for every syncable entity the client caches.
PULL_SOURCES = [
    (Table, TableSerializer, "tables"),
    (Category, CategorySerializer, "categories"),
    (MenuItem, MenuItemSerializer, "items"),
    (VariationGroup, VariationGroupSerializer, "variation_groups"),
    (VariationOption, VariationOptionSerializer, "variation_options"),
    (AddOn, AddOnSerializer, "addons"),
    (Customer, CustomerSerializer, "customers"),
    (Order, OrderSerializer, "orders"),
]


def _has_field(model, name):
    return any(f.name == name for f in model._meta.get_fields())


@extend_schema(
    operation_id="sync_pull",
    parameters=[OpenApiParameter("branch", str), OpenApiParameter("since", str)],
    responses={"type": "object"},
)
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def sync_pull(request):
    """Return rows changed since ?since (ISO8601). Includes tombstones
    (is_deleted). Omit `since` for a full snapshot."""
    # Parse defensively: a bad/undecodable `since` degrades to a full snapshot
    # rather than a 500 (e.g. an un-encoded "+" that arrives as a space).
    since_raw = request.query_params.get("since")
    since = parse_datetime(since_raw.replace(" ", "+")) if since_raw else None
    branch = request.query_params.get("branch")
    out = {"server_time": timezone.now()}

    for model, serializer, key in PULL_SOURCES:
        qs = model.objects.all()  # includes tombstones (not .alive())
        if since:
            qs = qs.modified_since(since)
        if branch and _has_field(model, "branch"):
            qs = qs.filter(branch=branch)
        elif branch and model is VariationGroup:
            qs = qs.filter(item__branch=branch)
        elif branch and model is VariationOption:
            qs = qs.filter(group__item__branch=branch)

        objs = list(qs)
        rows = serializer(objs, many=True, context={"request": request}).data
        # Every syncable row carries its tombstone flag + clock for the client's
        # last-write-wins merge, regardless of the base serializer's fields.
        for row, obj in zip(rows, objs):
            row["is_deleted"] = obj.is_deleted
            row["last_modified"] = obj.last_modified
        out[key] = rows

    return Response(out)
