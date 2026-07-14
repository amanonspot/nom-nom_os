import secrets

from drf_spectacular.utils import extend_schema
from rest_framework import status, viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.generics import RetrieveAPIView
from rest_framework.permissions import AllowAny, BasePermission, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken

from .constants import SERVICES, role_allows
from .models import Role, User
from .serializers import MeSerializer, UserAdminSerializer


def generate_pin() -> str:
    """A random 4-digit login PIN (0000–9999, zero-padded)."""
    return f"{secrets.randbelow(10000):04d}"


class MeView(RetrieveAPIView):
    """Return the authenticated user with restaurant/branch/role context."""

    serializer_class = MeSerializer

    @extend_schema(operation_id="me", responses=MeSerializer)
    def get(self, request, *args, **kwargs):
        return super().get(request, *args, **kwargs)

    def get_object(self):
        return self.request.user


class PinTokenView(APIView):
    """Sign in with username + login PIN, gated by service.

    ``{username, pin, service}`` → verify the PIN and that the user's role may
    access ``service`` (see ``SERVICE_ROLES``), then mint a JWT pair. Wrong
    credentials → 401; valid credentials but disallowed service → 403.
    """

    permission_classes = [AllowAny]

    @extend_schema(
        operation_id="pin_token",
        request={
            "type": "object",
            "properties": {
                "username": {"type": "string"},
                "pin": {"type": "string"},
                "service": {"type": "string", "enum": list(SERVICES)},
            },
            "required": ["username", "pin", "service"],
        },
        responses={"type": "object"},
    )
    def post(self, request):
        username = (request.data.get("username") or "").strip()
        pin = request.data.get("pin") or ""
        service = request.data.get("service") or ""

        if service not in SERVICES:
            return Response(
                {"detail": "Unknown service."}, status=status.HTTP_400_BAD_REQUEST
            )

        user = User.objects.filter(username__iexact=username, is_active=True).first()
        if user is None or not user.check_login_pin(pin):
            return Response(
                {"detail": "Invalid username or PIN."},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        if not role_allows(user.role, service):
            label = dict(Role.choices).get(user.role, user.role)
            return Response(
                {"detail": f"A {label} login can't access {service.upper()}."},
                status=status.HTTP_403_FORBIDDEN,
            )

        refresh = RefreshToken.for_user(user)
        return Response(
            {
                "access": str(refresh.access_token),
                "refresh": str(refresh),
                "role": user.role,
                "services": user.services,
            }
        )


@extend_schema(
    operation_id="verify_pin",
    request={"type": "object", "properties": {"pin": {"type": "string"}}},
    responses={"type": "object"},
)
@api_view(["POST"])
@permission_classes([IsAuthenticated])
def verify_pin(request):
    """Validate a manager PIN for overrides (comp, discounts). Returns
    {valid: bool} — the caller applies the action locally on success."""
    user = request.user
    pin = request.data.get("pin", "")
    valid = bool(user.can_authorize_overrides and user.check_manager_pin(pin))
    return Response({"valid": valid})


class IsAdminRole(BasePermission):
    """Staff-login management is available to anyone who can open the Admin
    portal (owner/admin/manager — see ``SERVICE_ROLES['admin']``)."""

    message = "You don't have access to staff-login management."

    def has_permission(self, request, view):
        user = request.user
        return bool(
            user and user.is_authenticated and role_allows(user.role, "admin")
        )


class UserAdminViewSet(viewsets.ModelViewSet):
    """Staff-login management for the Admin "Access" screen.

    Scoped to the caller's restaurant. Create/reset auto-generate a 4-digit PIN
    when none is supplied and return it **once** in plaintext so the admin can
    hand it out; it is stored only as a hash thereafter.
    """

    serializer_class = UserAdminSerializer
    permission_classes = [IsAdminRole]
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]

    def get_queryset(self):
        me = self.request.user
        qs = User.objects.all().order_by("username")
        if me.restaurant_id:
            qs = qs.filter(restaurant_id=me.restaurant_id)
        return qs

    def _apply_pin(self, user: User, raw_pin: str | None) -> str:
        pin = (raw_pin or "").strip() or generate_pin()
        user.set_login_pin(pin)
        return pin

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        me = request.user
        pin = serializer.validated_data.pop("pin", None)
        user = User(
            **serializer.validated_data,
            restaurant=me.restaurant,
            branch=me.branch,
        )
        user.set_unusable_password()
        plain_pin = self._apply_pin(user, pin)
        user.save()
        data = self.get_serializer(user).data
        data["pin"] = plain_pin  # revealed once
        return Response(data, status=status.HTTP_201_CREATED)

    def perform_update(self, serializer):
        pin = serializer.validated_data.pop("pin", None)
        user = serializer.save()
        if pin is not None:
            self._apply_pin(user, pin)
            user.save(update_fields=["login_pin"])

    @action(detail=True, methods=["post"])
    def reset_pin(self, request, pk=None):
        """Regenerate (or set) this user's login PIN; returns it once."""
        user = self.get_object()
        plain_pin = self._apply_pin(user, request.data.get("pin"))
        user.save(update_fields=["login_pin"])
        data = self.get_serializer(user).data
        data["pin"] = plain_pin
        return Response(data)
