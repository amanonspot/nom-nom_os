from rest_framework import serializers

from .models import Branch, Restaurant, User


class RestaurantSerializer(serializers.ModelSerializer):
    class Meta:
        model = Restaurant
        fields = ["id", "name", "gstin", "owner_email"]


class BranchSerializer(serializers.ModelSerializer):
    class Meta:
        model = Branch
        fields = ["id", "restaurant", "name", "address", "timezone"]


class MeSerializer(serializers.ModelSerializer):
    restaurant = RestaurantSerializer(read_only=True)
    branch = BranchSerializer(read_only=True)
    can_authorize_overrides = serializers.BooleanField(read_only=True)

    class Meta:
        model = User
        fields = [
            "id",
            "username",
            "email",
            "first_name",
            "last_name",
            "role",
            "restaurant",
            "branch",
            "can_authorize_overrides",
        ]
