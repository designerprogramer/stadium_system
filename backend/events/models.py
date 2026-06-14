from django.db import models
from django.conf import settings

class Event(models.Model):
    STATUS_CHOICES = (
        ('pending', 'Pending'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
    )
    
    title = models.CharField(max_length=200)
    description = models.TextField()
    date = models.DateTimeField()
    location = models.CharField(max_length=200)
    image = models.ImageField(upload_to='events/', null=True, blank=True)
    
    # Sport event fields
    is_sport_event = models.BooleanField(default=False)
    team1_name = models.CharField(max_length=100, blank=True, null=True)
    team2_name = models.CharField(max_length=100, blank=True, null=True)
    team1_logo = models.ImageField(upload_to='events/teams/', blank=True, null=True)
    team2_logo = models.ImageField(upload_to='events/teams/', blank=True, null=True)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='pending')
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='created_events')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.title} - {self.status}"

class Ticket(models.Model):
    SEAT_CHOICES = (
        ('VIP', 'VIP'),
        ('Normal', 'Normal'),
    )
    PAYMENT_STATUS_CHOICES = (
        ('pending', 'Pending'),
        ('paid', 'Paid'),
        ('canceled', 'Canceled'),
        ('refunded', 'Refunded'),
        ('failed', 'Failed'),
    )
    
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='tickets')
    event = models.ForeignKey(Event, on_delete=models.CASCADE, related_name='tickets')
    seat_type = models.CharField(max_length=10, choices=SEAT_CHOICES)
    price = models.DecimalField(max_digits=10, decimal_places=2)
    qr_code_hash = models.CharField(max_length=255, blank=True, null=True)
    is_paid = models.BooleanField(default=False)
    is_used = models.BooleanField(default=False)
    used_at = models.DateTimeField(null=True, blank=True)
    stripe_payment_intent_id = models.CharField(max_length=255, blank=True, null=True)
    stripe_refund_id = models.CharField(max_length=255, blank=True, null=True)
    payment_status = models.CharField(max_length=12, choices=PAYMENT_STATUS_CHOICES, default='pending')
    payment_expires_at = models.DateTimeField(null=True, blank=True)
    canceled_at = models.DateTimeField(null=True, blank=True)
    refunded_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['user', 'event'],
                condition=models.Q(is_paid=True),
                name='unique_paid_ticket_per_user_event',
            ),
        ]
    
    def __str__(self):
        return f"Ticket {self.id} for {self.event.title} - {self.seat_type}"


class TicketScan(models.Model):
    scanner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='ticket_scans',
    )
    ticket = models.ForeignKey(
        Ticket,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='scan_attempts',
    )
    status = models.CharField(max_length=30)
    message = models.CharField(max_length=255)
    scanned_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-scanned_at']


class ManualTicketRequest(models.Model):
    STATUS_CHOICES = (
        ('pending', 'Pending'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
    )

    requester = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='manual_ticket_requests',
    )
    target_username = models.CharField(max_length=150, blank=True, default='')
    target_full_name = models.CharField(max_length=255, blank=True, default='')
    target_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='manual_ticket_grants',
    )
    event = models.ForeignKey(Event, on_delete=models.CASCADE, related_name='manual_ticket_requests')
    seat_type = models.CharField(max_length=10, choices=Ticket.SEAT_CHOICES)
    reason = models.TextField(blank=True)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='pending')
    admin_note = models.TextField(blank=True)
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='reviewed_manual_ticket_requests',
    )
    ticket = models.OneToOneField(
        Ticket,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='manual_request',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    reviewed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"ManualTicketRequest {self.id} ({self.status})"


class ExternalStadiumBooking(models.Model):
    organizer_name = models.CharField(max_length=255)
    contact_phone = models.CharField(max_length=30)
    team1_name = models.CharField(max_length=100)
    team2_name = models.CharField(max_length=100)
    scheduled_at = models.DateTimeField(unique=True)
    amount_paid = models.DecimalField(max_digits=12, decimal_places=2)
    payment_reference = models.CharField(max_length=100, blank=True)
    notes = models.TextField(blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name='external_stadium_bookings',
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-scheduled_at']

    def __str__(self):
        return f"{self.team1_name} vs {self.team2_name} - {self.scheduled_at}"
