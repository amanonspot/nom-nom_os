"""Tenancy and identity: Restaurant → Branch → User (with RBAC)."""

from django.contrib.auth.models import AbstractUser
from django.db import models

from apps.common.models import SyncableModel


class Restaurant(SyncableModel):
    name = models.CharField(max_length=200)
    gstin = models.CharField("GSTIN", max_length=15, blank=True)
    owner_email = models.EmailField(blank=True)

    def __str__(self):
        return self.name


class Branch(SyncableModel):
    restaurant = models.ForeignKey(
        Restaurant, related_name="branches", on_delete=models.CASCADE
    )
    name = models.CharField(max_length=200)
    address = models.TextField(blank=True)
    timezone = models.CharField(max_length=64, default="Asia/Kolkata")

    class Meta(SyncableModel.Meta):
        verbose_name_plural = "branches"

    def __str__(self):
        return f"{self.restaurant.name} — {self.name}"


class Role(models.TextChoices):
    OWNER = "owner", "Owner"
    ADMIN = "admin", "Admin"
    MANAGER = "manager", "Manager"
    WAITER = "waiter", "Waiter"
    CASHIER = "cashier", "Cashier"
    KITCHEN = "kitchen", "Kitchen"


class User(AbstractUser):
    """Custom user bound to a branch and carrying an RBAC role.

    Two distinct PINs, both stored hashed via Django's password hashers:
    ``login_pin`` is the credential staff type (with their username) to *sign
    in* to a service; ``manager_pin`` authorizes overrides (voids, discounts) at
    the POS without a full re-login.
    """

    restaurant = models.ForeignKey(
        Restaurant, related_name="users", on_delete=models.CASCADE, null=True, blank=True
    )
    branch = models.ForeignKey(
        Branch, related_name="users", on_delete=models.SET_NULL, null=True, blank=True
    )
    role = models.CharField(max_length=20, choices=Role.choices, default=Role.WAITER)
    login_pin = models.CharField(max_length=128, blank=True)
    manager_pin = models.CharField(max_length=128, blank=True)

    def set_login_pin(self, raw_pin: str) -> None:
        from django.contrib.auth.hashers import make_password

        self.login_pin = make_password(raw_pin)

    def check_login_pin(self, raw_pin: str) -> bool:
        from django.contrib.auth.hashers import check_password

        return bool(self.login_pin) and check_password(raw_pin, self.login_pin)

    def set_manager_pin(self, raw_pin: str) -> None:
        from django.contrib.auth.hashers import make_password

        self.manager_pin = make_password(raw_pin)

    def check_manager_pin(self, raw_pin: str) -> bool:
        from django.contrib.auth.hashers import check_password

        return bool(self.manager_pin) and check_password(raw_pin, self.manager_pin)

    @property
    def can_authorize_overrides(self) -> bool:
        return self.role in {Role.OWNER, Role.ADMIN, Role.MANAGER}

    @property
    def services(self) -> list[str]:
        from .constants import services_for

        return services_for(self.role)
