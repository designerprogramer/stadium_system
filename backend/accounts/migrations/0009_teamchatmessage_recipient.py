from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0008_teamchatmessage'),
    ]

    operations = [
        migrations.AddField(
            model_name='teamchatmessage',
            name='recipient',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name='received_team_chat_messages',
                to=settings.AUTH_USER_MODEL,
            ),
        ),
    ]
