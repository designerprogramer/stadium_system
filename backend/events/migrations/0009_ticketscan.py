from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('events', '0009_ticket_payment_lifecycle'),
    ]

    operations = [
        migrations.CreateModel(
            name='TicketScan',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('status', models.CharField(max_length=30)),
                ('message', models.CharField(max_length=255)),
                ('scanned_at', models.DateTimeField(auto_now_add=True)),
                ('scanner', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='ticket_scans', to=settings.AUTH_USER_MODEL)),
                ('ticket', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='scan_attempts', to='events.ticket')),
            ],
            options={
                'ordering': ['-scanned_at'],
            },
        ),
    ]
