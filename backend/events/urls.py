from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    EventViewSet,
    ExternalStadiumBookingViewSet,
    ManualTicketRequestViewSet,
    admin_dashboard_stats,
    admin_financial_stats,
    admin_report_stats,
    cancel_payment_intent,
    confirm_ticket,
    create_payment_intent,
    event_history_report,
    my_tickets,
    public_upcoming_events,
    refund_ticket,
    recent_ticket_scans,
    schedule_calendar,
    staff_dashboard_stats,
    stadium_availability,
    stripe_webhook,
    ticket_scan_access,
    verify_ticket,
)

router = DefaultRouter()
router.register(r'', EventViewSet, basename='event')

urlpatterns = [
    path('public-upcoming/', public_upcoming_events, name='public_upcoming_events'),
    path(
        'external-bookings/',
        ExternalStadiumBookingViewSet.as_view({'get': 'list', 'post': 'create'}),
        name='external_stadium_bookings',
    ),
    path('create-payment-intent/', create_payment_intent, name='create_payment_intent'),
    path('cancel-payment-intent/', cancel_payment_intent, name='cancel_payment_intent'),
    path('confirm-ticket/', confirm_ticket, name='confirm_ticket'),
    path('stripe-webhook/', stripe_webhook, name='stripe_webhook'),
    path('tickets/<int:ticket_id>/refund/', refund_ticket, name='refund_ticket'),
    path('my-tickets/', my_tickets, name='my_tickets'),
    path('ticket-scan-access/', ticket_scan_access, name='ticket_scan_access'),
    path('verify-ticket/', verify_ticket, name='verify_ticket'),
    path('recent-ticket-scans/', recent_ticket_scans, name='recent_ticket_scans'),
    path('staff-stats/', staff_dashboard_stats, name='staff_dashboard_stats'),
    path('admin-dashboard-stats/', admin_dashboard_stats, name='admin_dashboard_stats'),
    path('admin-financial-stats/', admin_financial_stats, name='admin_financial_stats'),
    path('admin-report-stats/', admin_report_stats, name='admin_report_stats'),
    path('calendar/', schedule_calendar, name='schedule_calendar'),
    path('stadium-availability/', stadium_availability, name='stadium_availability'),
    path('event-history/', event_history_report, name='event_history_report'),
    path(
        'manual-ticket-requests/',
        ManualTicketRequestViewSet.as_view({'get': 'list', 'post': 'create'}),
        name='manual_ticket_requests',
    ),
    path(
        'manual-ticket-requests/<int:pk>/',
        ManualTicketRequestViewSet.as_view({'get': 'retrieve'}),
        name='manual_ticket_request_detail',
    ),
    path(
        'manual-ticket-requests/<int:pk>/review/',
        ManualTicketRequestViewSet.as_view({'patch': 'review'}),
        name='manual_ticket_request_review',
    ),
    path('', include(router.urls)),
]
