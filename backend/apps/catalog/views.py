from django.db.models import Prefetch
from drf_spectacular.utils import extend_schema
from rest_framework import viewsets
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import AddOn, Category, MenuItem, VariationGroup, VariationOption
from .serializers import (
    AddOnSerializer,
    CategorySerializer,
    CategoryWithItemsSerializer,
    MenuItemSerializer,
    VariationGroupSerializer,
    VariationOptionSerializer,
)


class BranchScopedViewSet(viewsets.ModelViewSet):
    """Base viewset: hides soft-deleted rows and filters by ?branch=<id>."""

    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = self.queryset.alive()
        branch = self.request.query_params.get("branch")
        if branch:
            qs = qs.filter(branch=branch)
        return qs

    def perform_destroy(self, instance):
        instance.soft_delete()


class CategoryViewSet(BranchScopedViewSet):
    queryset = Category.objects.all()
    serializer_class = CategorySerializer


class MenuItemViewSet(BranchScopedViewSet):
    queryset = MenuItem.objects.all()
    serializer_class = MenuItemSerializer


class AddOnViewSet(BranchScopedViewSet):
    queryset = AddOn.objects.all()
    serializer_class = AddOnSerializer


class VariationGroupViewSet(viewsets.ModelViewSet):
    """Variation groups filter by ?item=<id> (branch is implied by the item)."""

    permission_classes = [IsAuthenticated]
    queryset = VariationGroup.objects.all()
    serializer_class = VariationGroupSerializer

    def get_queryset(self):
        qs = self.queryset.alive()
        item = self.request.query_params.get("item")
        if item:
            qs = qs.filter(item=item)
        return qs

    def perform_destroy(self, instance):
        instance.soft_delete()


class VariationOptionViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    queryset = VariationOption.objects.all()
    serializer_class = VariationOptionSerializer

    def get_queryset(self):
        qs = self.queryset.alive()
        group = self.request.query_params.get("group")
        if group:
            qs = qs.filter(group=group)
        return qs

    def perform_destroy(self, instance):
        instance.soft_delete()


@extend_schema(
    operation_id="catalog_menu",
    responses=CategoryWithItemsSerializer(many=True),
    description="Full menu tree (categories → items → variation groups → options) for a branch.",
)
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def menu_tree(request):
    """One-shot menu for POS/offline caching."""
    categories = (
        Category.objects.alive()
        .filter(is_active=True)
        .prefetch_related(
            Prefetch(
                "items",
                queryset=MenuItem.objects.alive().prefetch_related(
                    Prefetch(
                        "variation_groups",
                        queryset=VariationGroup.objects.alive().prefetch_related("options"),
                    )
                ),
            )
        )
    )
    branch = request.query_params.get("branch")
    if branch:
        categories = categories.filter(branch=branch)
    data = CategoryWithItemsSerializer(categories, many=True, context={"request": request}).data
    return Response(data)
