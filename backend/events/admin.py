from django.contrib import admin

from .models import Event, ExternalStadiumBooking, ManualTicketRequest, Ticket


@admin.register(Event)
class EventAdmin(admin.ModelAdmin):
    list_display = ('title', 'status', 'created_by', 'date', 'location')
    list_filter = ('status', 'is_sport_event')
    search_fields = ('title', 'description', 'location')


@admin.register(Ticket)
class TicketAdmin(admin.ModelAdmin):
    list_display = ('id', 'user', 'event', 'seat_type', 'price', 'is_paid', 'is_used', 'created_at')
    list_filter = ('seat_type', 'is_paid', 'is_used')
    search_fields = ('user__username', 'event__title', 'qr_code_hash')


@admin.register(ManualTicketRequest)
class ManualTicketRequestAdmin(admin.ModelAdmin):
    list_display = ('id', 'requester', 'target_user', 'event', 'seat_type', 'status', 'created_at')
    list_filter = ('status', 'seat_type')
    search_fields = ('requester__username', 'target_user__username', 'event__title')


@admin.register(ExternalStadiumBooking)
class ExternalStadiumBookingAdmin(admin.ModelAdmin):
    list_display = ('id', 'team1_name', 'team2_name', 'scheduled_at', 'amount_paid', 'created_by')
    search_fields = ('organizer_name', 'contact_phone', 'team1_name', 'team2_name', 'payment_reference')
    list_filter = ('scheduled_at', 'created_by__role')
