from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin

from .models import Branch, Restaurant, User


@admin.register(Restaurant)
class RestaurantAdmin(admin.ModelAdmin):
    list_display = ("name", "gstin", "owner_email", "last_modified")
    search_fields = ("name", "gstin")


@admin.register(Branch)
class BranchAdmin(admin.ModelAdmin):
    list_display = ("name", "restaurant", "timezone", "last_modified")
    list_filter = ("restaurant",)


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    fieldsets = BaseUserAdmin.fieldsets + (
        ("Restaurant", {"fields": ("restaurant", "branch", "role", "manager_pin")}),
    )
    list_display = ("username", "email", "role", "restaurant", "branch", "is_staff")
    list_filter = BaseUserAdmin.list_filter + ("role",)
