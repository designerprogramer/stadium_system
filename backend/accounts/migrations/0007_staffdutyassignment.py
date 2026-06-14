from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('events', '0008_externalstadiumbooking'),
        ('accounts', '0006_user_profile_picture'),
    ]

    operations = [
        migrations.CreateModel(
            name='StaffDutyAssignment',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('duty_type', models.CharField(choices=[('ticket_scanning', 'Ticket Scanning'), ('gate_control', 'Gate Control'), ('crowd_support', 'Crowd Support'), ('field_support', 'Field Support'), ('customer_support', 'Customer Support'), ('security', 'Security'), ('maintenance', 'Maintenance')], max_length=30)),
                ('title', models.CharField(max_length=160)),
                ('starts_at', models.DateTimeField()),
                ('ends_at', models.DateTimeField()),
                ('location', models.CharField(blank=True, max_length=160)),
                ('notes', models.TextField(blank=True)),
                ('can_scan_tickets', models.BooleanField(default=False)),
                ('can_assign_manual_tickets', models.BooleanField(default=False)),
                ('can_manage_bookings', models.BooleanField(default=False)),
                ('can_manage_events', models.BooleanField(default=False)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('created_by', models.ForeignKey(limit_choices_to={'role': 'admin'}, on_delete=django.db.models.deletion.PROTECT, related_name='created_staff_duties', to=settings.AUTH_USER_MODEL)),
                ('event', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='staff_duties', to='events.event')),
                ('staff', models.ForeignKey(limit_choices_to={'role': 'staff'}, on_delete=django.db.models.deletion.CASCADE, related_name='duty_assignments', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'ordering': ['starts_at'],
            },
        ),
    ]
