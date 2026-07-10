from django.contrib import admin

from .models import Customer, Order, OrderItem, Payment, Table


class OrderItemInline(admin.TabularInline):
    model = OrderItem
    extra = 0


class PaymentInline(admin.TabularInline):
    model = Payment
    extra = 0


@admin.register(Table)
class TableAdmin(admin.ModelAdmin):
    list_display = ("name", "branch", "area", "seats", "status")
    list_filter = ("branch", "status")


@admin.register(Customer)
class CustomerAdmin(admin.ModelAdmin):
    list_display = ("name", "phone", "branch")
    search_fields = ("phone", "name")


@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = ("__str__", "branch", "table", "status", "grand_total", "last_modified")
    list_filter = ("branch", "status", "order_type")
    inlines = [OrderItemInline, PaymentInline]
