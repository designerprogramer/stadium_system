from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('events', '0007_manualticketrequest_target_full_name_and_more'),
    ]

    operations = [
        migrations.CreateModel(
            name='ExternalStadiumBooking',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('organizer_name', models.CharField(max_length=255)),
                ('contact_phone', models.CharField(max_length=30)),
                ('team1_name', models.CharField(max_length=100)),
                ('team2_name', models.CharField(max_length=100)),
                ('scheduled_at', models.DateTimeField(unique=True)),
                ('amount_paid', models.DecimalField(decimal_places=2, max_digits=12)),
                ('payment_reference', models.CharField(blank=True, max_length=100)),
                ('notes', models.TextField(blank=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('created_by', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='external_stadium_bookings', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'ordering': ['-scheduled_at'],
            },
        ),
    ]
