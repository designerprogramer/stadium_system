from django.db import migrations, models
from django.db.models import Q


def set_existing_payment_statuses(apps, schema_editor):
    Ticket = apps.get_model('events', 'Ticket')
    Ticket.objects.filter(is_paid=True).update(payment_status='paid')


class Migration(migrations.Migration):

    dependencies = [
        ('events', '0008_externalstadiumbooking'),
    ]

    operations = [
        migrations.AddField(
            model_name='ticket',
            name='canceled_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='ticket',
            name='payment_expires_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='ticket',
            name='payment_status',
            field=models.CharField(
                choices=[
                    ('pending', 'Pending'),
                    ('paid', 'Paid'),
                    ('canceled', 'Canceled'),
                    ('refunded', 'Refunded'),
                    ('failed', 'Failed'),
                ],
                default='pending',
                max_length=12,
            ),
        ),
        migrations.AddField(
            model_name='ticket',
            name='refunded_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='ticket',
            name='stripe_refund_id',
            field=models.CharField(blank=True, max_length=255, null=True),
        ),
        migrations.RunPython(set_existing_payment_statuses, migrations.RunPython.noop),
        migrations.AddConstraint(
            model_name='ticket',
            constraint=models.UniqueConstraint(
                condition=Q(is_paid=True),
                fields=('user', 'event'),
                name='unique_paid_ticket_per_user_event',
            ),
        ),
    ]
