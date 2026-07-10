from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from .models import AddOn, Category, MenuItem, VariationGroup, VariationOption


class VariationOptionSerializer(serializers.ModelSerializer):
    class Meta:
        model = VariationOption
        fields = ["id", "group", "name", "price_delta", "is_default", "sort_order"]


class VariationGroupSerializer(serializers.ModelSerializer):
    options = VariationOptionSerializer(many=True, read_only=True)

    class Meta:
        model = VariationGroup
        fields = ["id", "item", "name", "is_required", "sort_order", "options"]


class AddOnSerializer(serializers.ModelSerializer):
    class Meta:
        model = AddOn
        fields = ["id", "branch", "name", "price", "is_active"]


class MenuItemSerializer(serializers.ModelSerializer):
    variation_groups = VariationGroupSerializer(many=True, read_only=True)

    class Meta:
        model = MenuItem
        fields = [
            "id",
            "branch",
            "category",
            "name",
            "description",
            "base_price",
            "is_veg",
            "pieces_per_plate",
            "gst_rate",
            "is_available",
            "sort_order",
            "variation_groups",
        ]


class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ["id", "branch", "name", "sort_order", "is_active"]


class CategoryWithItemsSerializer(serializers.ModelSerializer):
    """Category with its nested items — the POS/offline menu tree."""

    items = serializers.SerializerMethodField()

    class Meta:
        model = Category
        fields = ["id", "branch", "name", "sort_order", "is_active", "items"]

    @extend_schema_field(MenuItemSerializer(many=True))
    def get_items(self, obj):
        items = obj.items.alive().filter(is_available=True)
        return MenuItemSerializer(items, many=True, context=self.context).data
