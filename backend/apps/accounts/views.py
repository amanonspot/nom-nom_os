from drf_spectacular.utils import extend_schema
from rest_framework.decorators import api_view, permission_classes
from rest_framework.generics import RetrieveAPIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .serializers import MeSerializer


class MeView(RetrieveAPIView):
    """Return the authenticated user with restaurant/branch/role context."""

    serializer_class = MeSerializer

    @extend_schema(operation_id="me", responses=MeSerializer)
    def get(self, request, *args, **kwargs):
        return super().get(request, *args, **kwargs)

    def get_object(self):
        return self.request.user


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
