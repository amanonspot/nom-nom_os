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
    services = serializers.ListField(child=serializers.CharField(), read_only=True)

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
            "services",
        ]


class UserAdminSerializer(serializers.ModelSerializer):
    """Staff row for the Admin "Access" screen. Read exposes derived services and
    whether a login PIN is set; write accepts username/role/branch/is_active and
    an optional plaintext ``pin`` (write-only). The PIN hash is never returned."""

    services = serializers.ListField(child=serializers.CharField(), read_only=True)
    has_pin = serializers.SerializerMethodField()
    branch = BranchSerializer(read_only=True)
    pin = serializers.CharField(write_only=True, required=False, allow_blank=True)

    class Meta:
        model = User
        fields = [
            "id",
            "username",
            "role",
            "services",
            "branch",
            "is_active",
            "has_pin",
            "pin",
        ]
        read_only_fields = ["id"]

    def get_has_pin(self, obj: User) -> bool:
        return bool(obj.login_pin)
