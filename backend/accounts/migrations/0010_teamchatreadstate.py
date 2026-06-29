from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0009_teamchatmessage_recipient'),
    ]

    operations = [
        migrations.CreateModel(
            name='TeamChatReadState',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('chat_key', models.CharField(max_length=40)),
                ('last_read_at', models.DateTimeField(blank=True, null=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='team_chat_read_states', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'unique_together': {('user', 'chat_key')},
            },
        ),
    ]
