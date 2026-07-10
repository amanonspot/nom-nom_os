"""Shared model bases for offline-first sync.

Every entity that can be created or edited on a device and synced to the cloud
inherits from :class:`SyncableModel`. Three invariants make last-write-wins
push/pull safe across offline devices:

* ``id`` is a client-generatable UUID, so two offline terminals never collide.
* ``last_modified`` is refreshed on every save and drives conflict resolution.
* ``is_deleted`` is a soft-delete tombstone so deletes propagate through pull.
"""

import uuid

from django.db import models
from django.utils import timezone


class SyncableQuerySet(models.QuerySet):
    def alive(self):
        return self.filter(is_deleted=False)

    def modified_since(self, since):
        return self.filter(last_modified__gt=since)


class SyncableModel(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    created_at = models.DateTimeField(default=timezone.now, editable=False)
    last_modified = models.DateTimeField(default=timezone.now, db_index=True)
    is_deleted = models.BooleanField(default=False)

    objects = SyncableQuerySet.as_manager()

    class Meta:
        abstract = True
        ordering = ["-last_modified"]

    def save(self, *args, **kwargs):
        # Refresh the sync clock unless a caller explicitly preserves it
        # (e.g. applying an inbound record during a pull).
        if not kwargs.pop("preserve_last_modified", False):
            self.last_modified = timezone.now()
        super().save(*args, **kwargs)

    def soft_delete(self):
        self.is_deleted = True
        self.save()
