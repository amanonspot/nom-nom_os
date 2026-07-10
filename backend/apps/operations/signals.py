"""Broadcast order changes to the branch KDS group after each commit.

Item-level kitchen changes flow through here too: the per-item endpoint recomputes
and saves the parent Order, which triggers this signal.
"""

from django.db import transaction
from django.db.models.signals import post_save
from django.dispatch import receiver

from apps.realtime.broadcast import broadcast_order

from .models import Order


@receiver(post_save, sender=Order)
def order_saved(sender, instance, created, **kwargs):
    event = "order.new" if created else "order.kitchen"
    # Broadcast only after the DB transaction commits (avoids phantom rows if a
    # sync push rolls back).
    transaction.on_commit(lambda: broadcast_order(instance, event))
