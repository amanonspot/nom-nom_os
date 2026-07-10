from django.urls import path

from .views import sync_pull, sync_push

urlpatterns = [
    path("push/", sync_push, name="sync-push"),
    path("pull/", sync_pull, name="sync-pull"),
]
