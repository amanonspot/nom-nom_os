from django.contrib import admin

from .models import AddOn, Category, MenuItem, VariationGroup, VariationOption


class VariationOptionInline(admin.TabularInline):
    model = VariationOption
    extra = 1


class VariationGroupInline(admin.TabularInline):
    model = VariationGroup
    extra = 0


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ("name", "branch", "sort_order", "is_active")
    list_filter = ("branch", "is_active")


@admin.register(MenuItem)
class MenuItemAdmin(admin.ModelAdmin):
    list_display = ("name", "category", "base_price", "is_veg", "gst_rate", "is_available")
    list_filter = ("branch", "category", "is_veg", "is_available")
    inlines = [VariationGroupInline]


@admin.register(VariationGroup)
class VariationGroupAdmin(admin.ModelAdmin):
    list_display = ("name", "item", "is_required")
    inlines = [VariationOptionInline]


@admin.register(AddOn)
class AddOnAdmin(admin.ModelAdmin):
    list_display = ("name", "branch", "price", "is_active")
    list_filter = ("branch", "is_active")
