from drf_spectacular.utils import extend_schema
from rest_framework.generics import RetrieveAPIView

from .serializers import MeSerializer


class MeView(RetrieveAPIView):
    """Return the authenticated user with restaurant/branch/role context."""

    serializer_class = MeSerializer

    @extend_schema(operation_id="me", responses=MeSerializer)
    def get(self, request, *args, **kwargs):
        return super().get(request, *args, **kwargs)

    def get_object(self):
        return self.request.user
