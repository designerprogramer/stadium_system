from django.contrib.auth.models import AbstractUser
from django.db import models
from django.utils import timezone
from datetime import timedelta
import random

class User(AbstractUser):
    ROLE_CHOICES = (
        ('admin', 'Admin'),
        ('staff', 'Staff'),
        ('user', 'User'),
    )

    role = models.CharField(max_length=10, choices=ROLE_CHOICES, default='user')
    profile_picture = models.FileField(upload_to='profile_pictures/', blank=True, null=True)


class RegistrationRequest(models.Model):
    email = models.EmailField(unique=True)
    username = models.CharField(max_length=150)
    password = models.CharField(max_length=128)
    otp = models.CharField(max_length=6)
    otp_expires_at = models.DateTimeField()
    verified = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"RegistrationRequest({self.email})"


class OTP(models.Model):
    PURPOSE_CHOICES = (
        ('password_reset', 'Password Reset'),
    )

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='otps')
    code = models.CharField(max_length=6)
    purpose = models.CharField(max_length=20, choices=PURPOSE_CHOICES)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    used = models.BooleanField(default=False)

    @classmethod
    def generate_code(cls):
        return f"{random.randint(100000, 999999)}"

    @classmethod
    def create_for_user(cls, user, purpose):
        code = cls.generate_code()
        expires_at = timezone.now() + timedelta(minutes=15)
        return cls.objects.create(user=user, code=code, purpose=purpose, expires_at=expires_at)

    def mark_used(self):
        self.used = True
        self.save()

    def is_valid(self, code):
        return (
            not self.used
            and self.code == code
            and self.expires_at >= timezone.now()
        )

    def __str__(self):
        return f"OTP({self.user.email}, {self.purpose}, {self.code})"

class Notification(models.Model):
    TYPE_CHOICES = (
        ('info', 'Info'),
        ('success', 'Success'),
        ('reminder', 'Reminder'),
        ('warning', 'Warning'),
    )
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='notifications')
    title = models.CharField(max_length=200)
    message = models.TextField()
    type = models.CharField(max_length=20, choices=TYPE_CHOICES, default='info')
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Notification({self.user.username}, {self.title})"


class StaffDutyAssignment(models.Model):
    DUTY_CHOICES = (
        ('ticket_scanning', 'Ticket Scanning'),
        ('gate_control', 'Gate Control'),
        ('crowd_support', 'Crowd Support'),
        ('field_support', 'Field Support'),
        ('customer_support', 'Customer Support'),
        ('security', 'Security'),
        ('maintenance', 'Maintenance'),
    )

    staff = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='duty_assignments',
        limit_choices_to={'role': 'staff'},
    )
    event = models.ForeignKey(
        'events.Event',
        on_delete=models.CASCADE,
        related_name='staff_duties',
        null=True,
        blank=True,
    )
    duty_type = models.CharField(max_length=30, choices=DUTY_CHOICES)
    title = models.CharField(max_length=160)
    starts_at = models.DateTimeField()
    ends_at = models.DateTimeField()
    location = models.CharField(max_length=160, blank=True)
    notes = models.TextField(blank=True)
    can_scan_tickets = models.BooleanField(default=False)
    can_assign_manual_tickets = models.BooleanField(default=False)
    can_manage_bookings = models.BooleanField(default=False)
    can_manage_events = models.BooleanField(default=False)
    created_by = models.ForeignKey(
        User,
        on_delete=models.PROTECT,
        related_name='created_staff_duties',
        limit_choices_to={'role': 'admin'},
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['starts_at']

    def __str__(self):
        return f"{self.staff.username} - {self.title}"


class SupportConversation(models.Model):
    STATUS_CHOICES = (
        ('new', 'New'),
        ('assigned', 'Assigned'),
        ('waiting_user', 'Waiting User'),
        ('resolved', 'Resolved'),
        ('closed', 'Closed'),
    )

    CATEGORY_CHOICES = (
        ('general', 'General'),
        ('ticket', 'Ticket'),
        ('payment', 'Payment'),
        ('account', 'Account'),
        ('policy', 'Policy'),
        ('complaint', 'Complaint'),
    )

    PRIORITY_CHOICES = (
        ('low', 'Low'),
        ('normal', 'Normal'),
        ('high', 'High'),
        ('urgent', 'Urgent'),
    )

    ASSIGNED_ROLE_CHOICES = (
        ('staff', 'Staff'),
        ('admin', 'Admin'),
    )

    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='support_conversations',
    )
    assigned_to = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='assigned_support_conversations',
    )
    assigned_role = models.CharField(max_length=10, choices=ASSIGNED_ROLE_CHOICES, default='staff')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='new')
    category = models.CharField(max_length=20, choices=CATEGORY_CHOICES, default='general')
    priority = models.CharField(max_length=20, choices=PRIORITY_CHOICES, default='normal')
    subject = models.CharField(max_length=200, blank=True)
    last_message_preview = models.CharField(max_length=280, blank=True)
    last_message_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-last_message_at', '-created_at']

    def __str__(self):
        return f"SupportConversation({self.id}, {self.user.username}, {self.status})"


class SupportMessage(models.Model):
    SENDER_ROLE_CHOICES = (
        ('user', 'User'),
        ('staff', 'Staff'),
        ('admin', 'Admin'),
    )

    conversation = models.ForeignKey(
        SupportConversation,
        on_delete=models.CASCADE,
        related_name='messages',
    )
    sender = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='support_messages',
    )
    sender_role = models.CharField(max_length=10, choices=SENDER_ROLE_CHOICES)
    message = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at']

    def __str__(self):
        return f"SupportMessage({self.conversation_id}, {self.sender.username})"


class TeamChatMessage(models.Model):
    sender = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='team_chat_messages',
    )
    recipient = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='received_team_chat_messages',
        null=True,
        blank=True,
    )
    message = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at']

    def __str__(self):
        return f"TeamChatMessage({self.sender.username}, {self.created_at})"


class TeamChatReadState(models.Model):
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='team_chat_read_states',
    )
    chat_key = models.CharField(max_length=40)
    last_read_at = models.DateTimeField(null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('user', 'chat_key')

    def __str__(self):
        return f"TeamChatReadState({self.user.username}, {self.chat_key})"
