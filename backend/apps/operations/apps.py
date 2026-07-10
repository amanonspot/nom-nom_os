from django.apps import AppConfig


class OperationsConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.operations'

    def ready(self):
        from . import signals  # noqa: F401  (registers post_save broadcast)
