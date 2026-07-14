"""Which staff roles may sign in to which service surface.

Login is role-gated per service: a credential can only open a part its role is
allowed to access (e.g. a Kitchen login opens KDS only; a Manager opens all
three). ``SERVICE_ROLES`` is the single source of truth; ``services_for`` is the
inverse used by ``/api/me`` and the shared login UI.
"""

from .models import Role

SERVICES = ("pos", "kds", "admin")

SERVICE_ROLES: dict[str, set[str]] = {
    "admin": {Role.OWNER, Role.ADMIN, Role.MANAGER},
    "pos": {Role.OWNER, Role.ADMIN, Role.MANAGER, Role.CASHIER, Role.WAITER},
    "kds": {Role.OWNER, Role.ADMIN, Role.MANAGER, Role.KITCHEN},
}


def role_allows(role: str, service: str) -> bool:
    return role in SERVICE_ROLES.get(service, set())


def services_for(role: str) -> list[str]:
    """The services a role can access, in canonical order."""
    return [svc for svc in SERVICES if role in SERVICE_ROLES[svc]]
