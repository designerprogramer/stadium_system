import hashlib
import uuid
from datetime import datetime, timedelta
from decimal import Decimal

import stripe
from django.conf import settings
from django.db import transaction
from django.db.models import Count, Q, Sum
from django.db.models.functions import TruncDate, TruncMonth
from django.utils import timezone
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response

from accounts.models import Notification, StaffDutyAssignment, User

from .models import Event, ExternalStadiumBooking, ManualTicketRequest, Ticket, TicketScan
from .serializers import (
    EventSerializer,
    EventUpdateStatusSerializer,
    ExternalStadiumBookingSerializer,
    ManualTicketReviewSerializer,
    ManualTicketRequestSerializer,
    TicketSerializer,
)

stripe.api_key = settings.STRIPE_SECRET_KEY

STRIPE_CONFIGURATION_ERROR = (
    'Stripe is not configured. Set STRIPE_SECRET_KEY on the backend and '
    'VITE_STRIPE_PUBLISHABLE_KEY on the frontend, then restart both servers.'
)


def _stripe_is_configured():
    secret_key = settings.STRIPE_SECRET_KEY.strip()
    return secret_key.startswith(('sk_test_', 'sk_live_')) and 'replace_me' not in secret_key


@api_view(['GET'])
@permission_classes([permissions.AllowAny])
def public_upcoming_events(request):
    events = Event.objects.filter(status='approved', date__gte=timezone.now()).order_by('date')[:6]
    return Response([
        {
            'id': event.id,
            'title': event.title,
            'date': event.date,
            'location': event.location,
            'is_sport_event': event.is_sport_event,
            'team1_name': event.team1_name,
            'team2_name': event.team2_name,
        }
        for event in events
    ])


def _to_float(value):
    return float(value or 0)


def _period_change(current, previous):
    current_value = float(current or 0)
    previous_value = float(previous or 0)
    delta = current_value - previous_value
    if previous_value == 0:
        percent = None if current_value else 0
    else:
        percent = round((delta / previous_value) * 100, 1)
    return {
        'current': current_value,
        'previous': previous_value,
        'delta': round(delta, 2),
        'percent': percent,
    }


def _is_admin(user):
    return user.role == 'admin'


def _is_staff_or_admin(user):
    return user.role in ['staff', 'admin']


def _staff_has_active_permission(user, permission_name, event=None):
    if _is_admin(user):
        return True
    if user.role != 'staff':
        return False

    now = timezone.now()
    duties = StaffDutyAssignment.objects.filter(
        staff=user,
        starts_at__lte=now,
        ends_at__gte=now,
        **{permission_name: True},
    )
    if event is not None:
        duties = duties.filter(Q(event__isnull=True) | Q(event=event))
    return duties.exists()


def _require_staff_permission(user, permission_name, message, event=None):
    if not _staff_has_active_permission(user, permission_name, event):
        raise PermissionDenied(message)


def _notify_admins(title, message, notification_type='info'):
    admin_users = User.objects.filter(role='admin', is_active=True)
    notifications = [
        Notification(user=admin, title=title, message=message, type=notification_type)
        for admin in admin_users
    ]
    if notifications:
        Notification.objects.bulk_create(notifications)


STADIUM_SLOT_HOURS = 3


def _clash_window(scheduled_at):
    return scheduled_at - timedelta(hours=STADIUM_SLOT_HOURS), scheduled_at + timedelta(hours=STADIUM_SLOT_HOURS)


def _stadium_clashes(scheduled_at, exclude_event_id=None, exclude_booking_id=None):
    window_start, window_end = _clash_window(scheduled_at)
    events = Event.objects.filter(date__gt=window_start, date__lt=window_end).exclude(status='rejected')
    bookings = ExternalStadiumBooking.objects.filter(scheduled_at__gt=window_start, scheduled_at__lt=window_end)

    if exclude_event_id:
        events = events.exclude(id=exclude_event_id)
    if exclude_booking_id:
        bookings = bookings.exclude(id=exclude_booking_id)

    return events, bookings


def _raise_if_stadium_clash(scheduled_at, exclude_event_id=None, exclude_booking_id=None):
    events, bookings = _stadium_clashes(scheduled_at, exclude_event_id, exclude_booking_id)
    if events.exists() or bookings.exists():
        raise ValidationError(
            'Stadium is already booked within the protected scheduling window. '
            'Choose a time at least three hours away from another event or booking.'
        )


class EventViewSet(viewsets.ModelViewSet):
    serializer_class = EventSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        queryset = Event.objects.select_related('created_by').order_by('-created_at')
        if user.role in ['admin', 'staff']:
            return queryset
        return queryset.filter(status='approved')

    def perform_create(self, serializer):
        user = self.request.user
        if not _is_staff_or_admin(user):
            raise PermissionDenied('Only staff and admins can create events.')
        if user.role == 'staff':
            _require_staff_permission(
                user,
                'can_manage_events',
                'You need an active event-management duty to create events.',
            )

        _raise_if_stadium_clash(serializer.validated_data['date'])

        requested_status = serializer.validated_data.get('status')
        if _is_admin(user):
            final_status = requested_status or 'approved'
        else:
            final_status = 'pending'

        event = serializer.save(created_by=user, status=final_status)

        if user.role == 'staff':
            _notify_admins(
                title='New Event Awaiting Approval',
                message=(
                    f'{user.username} submitted a new event "{event.title}". '
                    'Please approve or revoke it.'
                ),
                notification_type='info',
            )

    def _ensure_manage_permission(self, event):
        user = self.request.user
        if _is_admin(user):
            return
        if user.role == 'staff' and event.created_by_id == user.id:
            _require_staff_permission(
                user,
                'can_manage_events',
                'You need an active event-management duty to edit this event.',
                event,
            )
            return
        raise PermissionDenied('You do not have permission to edit this event.')

    def update(self, request, *args, **kwargs):
        event = self.get_object()
        self._ensure_manage_permission(event)
        return super().update(request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        event = self.get_object()
        self._ensure_manage_permission(event)
        return super().partial_update(request, *args, **kwargs)

    def perform_update(self, serializer):
        user = self.request.user
        next_date = serializer.validated_data.get('date', serializer.instance.date)
        _raise_if_stadium_clash(next_date, exclude_event_id=serializer.instance.id)

        if user.role == 'staff':
            event = serializer.save(status='pending')
            _notify_admins(
                title='Event Updated And Waiting Approval',
                message=(
                    f'{user.username} updated event "{event.title}". '
                    'Please approve or revoke the latest changes.'
                ),
                notification_type='info',
            )
        else:
            serializer.save()

    def destroy(self, request, *args, **kwargs):
        event = self.get_object()
        self._ensure_manage_permission(event)
        return super().destroy(request, *args, **kwargs)

    @action(detail=True, methods=['patch'], url_path='update-status')
    def update_status(self, request, pk=None):
        if not _is_admin(request.user):
            return Response(
                {'detail': 'Only admins can update event status.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        event = self.get_object()
        serializer = EventUpdateStatusSerializer(event, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()

        if event.created_by_id != request.user.id:
            if event.status == 'approved':
                Notification.objects.create(
                    user=event.created_by,
                    title='Event Approved',
                    message=f'Your event "{event.title}" was approved by admin.',
                    type='success',
                )
            elif event.status == 'rejected':
                Notification.objects.create(
                    user=event.created_by,
                    title='Event Revoked',
                    message=f'Your event "{event.title}" was revoked by admin.',
                    type='warning',
                )

        return Response(EventSerializer(event).data)


class ExternalStadiumBookingViewSet(viewsets.ModelViewSet):
    serializer_class = ExternalStadiumBookingSerializer
    permission_classes = [permissions.IsAuthenticated]
    http_method_names = ['get', 'post', 'head', 'options']
    queryset = ExternalStadiumBooking.objects.select_related('created_by')

    def get_queryset(self):
        if not _is_staff_or_admin(self.request.user):
            raise PermissionDenied('Only staff and admins can access stadium bookings.')
        return self.queryset

    def create(self, request, *args, **kwargs):
        if not _is_staff_or_admin(request.user):
            raise PermissionDenied('Only staff and admins can register stadium bookings.')
        if request.user.role == 'staff':
            _require_staff_permission(
                request.user,
                'can_manage_bookings',
                'You need an active booking-management duty to register stadium bookings.',
            )
        return super().create(request, *args, **kwargs)

    def perform_create(self, serializer):
        _raise_if_stadium_clash(serializer.validated_data['scheduled_at'])
        booking = serializer.save(created_by=self.request.user)
        if self.request.user.role == 'staff':
            _notify_admins(
                title='External Stadium Booking Registered',
                message=(
                    f'{self.request.user.username} registered {booking.team1_name} vs '
                    f'{booking.team2_name} for {booking.scheduled_at:%Y-%m-%d %H:%M}.'
                ),
                notification_type='success',
            )


class ManualTicketRequestViewSet(viewsets.ModelViewSet):
    serializer_class = ManualTicketRequestSerializer
    permission_classes = [permissions.IsAuthenticated]
    queryset = ManualTicketRequest.objects.select_related(
        'requester',
        'target_user',
        'event',
        'reviewed_by',
        'ticket',
    )

    def get_queryset(self):
        user = self.request.user
        queryset = super().get_queryset()

        if user.role == 'admin':
            return queryset
        if user.role == 'staff':
            return queryset.filter(requester=user)
        return queryset.none()

    def create(self, request, *args, **kwargs):
        if request.user.role != 'staff':
            raise PermissionDenied('Only staff can submit manual ticket requests.')
        _require_staff_permission(
            request.user,
            'can_assign_manual_tickets',
            'You need an active manual-ticket duty to submit free ticket requests.',
        )

        return super().create(request, *args, **kwargs)

    def perform_create(self, serializer):
        if _user_has_paid_ticket(serializer.validated_data['target_user'], serializer.validated_data['event']):
            raise ValidationError('This user already has a ticket for this event.')

        duplicate_pending = ManualTicketRequest.objects.filter(
            requester=self.request.user,
            target_user=serializer.validated_data['target_user'],
            event=serializer.validated_data['event'],
            seat_type=serializer.validated_data['seat_type'],
            status='pending',
        ).exists()

        if duplicate_pending:
            raise ValidationError('A pending request for this user and event already exists.')

        manual_request = serializer.save(requester=self.request.user)

        _notify_admins(
            title='Manual Ticket Request Submitted',
            message=(
                f"{self.request.user.username} requested a {manual_request.seat_type} "
                f"manual ticket for {manual_request.target_full_name} "
                f"(@{manual_request.target_username}) "
                f"({manual_request.event.title})."
            ),
            notification_type='info',
        )

    @action(detail=True, methods=['patch'], url_path='review')
    def review(self, request, pk=None):
        if request.user.role != 'admin':
            raise PermissionDenied('Only admins can review manual ticket requests.')

        manual_request = self.get_object()
        if manual_request.status != 'pending':
            return Response(
                {'detail': 'This request has already been reviewed.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = ManualTicketReviewSerializer(
            manual_request,
            data=request.data,
            partial=True,
        )
        serializer.is_valid(raise_exception=True)

        decision = serializer.validated_data.get('status')
        if not decision:
            return Response(
                {'detail': 'status is required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        admin_note = serializer.validated_data.get('admin_note', '')

        with transaction.atomic():
            manual_request = (
                ManualTicketRequest.objects.select_for_update()
                .select_related('target_user', 'event')
                .get(pk=manual_request.pk)
            )

            if manual_request.status != 'pending':
                return Response(
                    {'detail': 'This request has already been reviewed.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            if decision == 'approved':
                if manual_request.event.status != 'approved':
                    return Response(
                        {'detail': 'Tickets cannot be issued for a revoked or pending event.'},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
                if manual_request.event.date <= timezone.now():
                    return Response(
                        {'detail': 'Tickets cannot be issued for an expired event.'},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
                if _user_has_paid_ticket(manual_request.target_user, manual_request.event):
                    return Response(
                        {'detail': 'This user already has a ticket for this event.'},
                        status=status.HTTP_400_BAD_REQUEST,
                    )

            manual_request.status = decision
            manual_request.admin_note = admin_note
            manual_request.reviewed_by = request.user
            manual_request.reviewed_at = timezone.now()

            if decision == 'approved':
                seat_price = Decimal('0.00')
                ticket = Ticket.objects.create(
                    user=manual_request.target_user,
                    event=manual_request.event,
                    seat_type=manual_request.seat_type,
                    price=seat_price,
                    is_paid=True,
                    payment_status='paid',
                    qr_code_hash=hashlib.sha256(
                        f"manual-{manual_request.id}-{manual_request.target_user_id}-{uuid.uuid4()}".encode()
                    ).hexdigest(),
                )
                manual_request.ticket = ticket

                Notification.objects.create(
                    user=manual_request.target_user,
                    title='Manual Ticket Approved',
                    message=(
                        f"A staff member assigned you a {manual_request.seat_type} ticket "
                        f"for {manual_request.event.title}."
                    ),
                    type='success',
                )
                Notification.objects.create(
                    user=manual_request.requester,
                    title='Manual Request Approved',
                    message=(
                        f"Your request for {manual_request.target_full_name} "
                        f"(@{manual_request.target_username}) "
                        f"({manual_request.event.title}) was approved."
                    ),
                    type='success',
                )
            else:
                Notification.objects.create(
                    user=manual_request.requester,
                    title='Manual Request Revoked',
                    message=(
                        f"Your request for {manual_request.target_full_name} "
                        f"(@{manual_request.target_username}) "
                        f"({manual_request.event.title}) was revoked."
                    ),
                    type='warning',
                )
                Notification.objects.create(
                    user=manual_request.target_user,
                    title='Free Ticket Request Revoked',
                    message=(
                        f'Your free ticket request for "{manual_request.event.title}" was revoked by admin.'
                    ),
                    type='warning',
                )

            manual_request.save()

        return Response(ManualTicketRequestSerializer(manual_request).data)


def _event_price_for_seat(seat_type):
    return Decimal('3.00') if seat_type == 'VIP' else Decimal('1.00')


def _user_has_paid_ticket(user, event, exclude_ticket_id=None):
    tickets = Ticket.objects.filter(user=user, event=event, is_paid=True)
    if exclude_ticket_id:
        tickets = tickets.exclude(id=exclude_ticket_id)
    return tickets.exists()


PAYMENT_INTENT_TTL = timedelta(minutes=30)


def _cancel_pending_ticket(ticket):
    if ticket.stripe_payment_intent_id:
        try:
            stripe.PaymentIntent.cancel(ticket.stripe_payment_intent_id)
        except Exception:
            pass
    ticket.payment_status = 'canceled'
    ticket.canceled_at = timezone.now()
    ticket.payment_expires_at = None
    ticket.save(update_fields=['payment_status', 'canceled_at', 'payment_expires_at'])


def _finalize_succeeded_ticket(ticket, payment_intent_id):
    if ticket.is_paid and ticket.payment_status == 'paid':
        return 'paid'

    if _user_has_paid_ticket(ticket.user, ticket.event, exclude_ticket_id=ticket.id):
        refund = stripe.Refund.create(payment_intent=payment_intent_id, reason='duplicate')
        ticket.payment_status = 'refunded'
        ticket.stripe_refund_id = refund.id
        ticket.refunded_at = timezone.now()
        ticket.payment_expires_at = None
        ticket.save(update_fields=['payment_status', 'stripe_refund_id', 'refunded_at', 'payment_expires_at'])
        return 'refunded'

    ticket.is_paid = True
    ticket.payment_status = 'paid'
    ticket.payment_expires_at = None
    qr_data = f"{ticket.id}-{ticket.user.id}-{payment_intent_id}-{uuid.uuid4()}"
    ticket.qr_code_hash = hashlib.sha256(qr_data.encode()).hexdigest()
    ticket.save(update_fields=['is_paid', 'payment_status', 'payment_expires_at', 'qr_code_hash'])

    Notification.objects.create(
        user=ticket.user,
        title='Payment Successful!',
        message=f"You successfully purchased a {ticket.seat_type} ticket for {ticket.event.title}.",
        type='success',
    )
    Notification.objects.create(
        user=ticket.user,
        title=f"Reminder: {ticket.event.title}",
        message=f"Your upcoming event is scheduled for {ticket.event.date:%B %d, %Y at %I:%M %p}. Don't forget your ticket!",
        type='reminder',
    )
    return 'paid'


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def create_payment_intent(request):
    if not _stripe_is_configured():
        return Response({'error': STRIPE_CONFIGURATION_ERROR}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

    event_id = request.data.get('event_id')
    seat_type = request.data.get('seat_type')

    if not event_id or not seat_type:
        return Response({'error': 'event_id and seat_type are required'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        event = Event.objects.get(id=event_id)
    except Event.DoesNotExist:
        return Response({'error': 'Event not found'}, status=status.HTTP_404_NOT_FOUND)

    if event.status != 'approved':
        return Response({'error': 'Tickets can only be purchased for approved events.'}, status=status.HTTP_400_BAD_REQUEST)

    if event.date <= timezone.now():
        return Response({'error': 'This event has expired. Ticket sales are closed.'}, status=status.HTTP_400_BAD_REQUEST)

    if _user_has_paid_ticket(request.user, event):
        return Response({'error': 'You already bought a ticket for this event.'}, status=status.HTTP_400_BAD_REQUEST)

    if seat_type not in ['VIP', 'Normal']:
        return Response({'error': 'Invalid seat type. Must be VIP or Normal'}, status=status.HTTP_400_BAD_REQUEST)

    price = _event_price_for_seat(seat_type)
    now = timezone.now()

    with transaction.atomic():
        User.objects.select_for_update().get(pk=request.user.pk)
        pending_tickets = list(
            Ticket.objects.select_for_update()
            .filter(user=request.user, event=event, payment_status='pending', is_paid=False)
            .order_by('-created_at')
        )

        for pending in pending_tickets:
            if pending.seat_type == seat_type and pending.payment_expires_at and pending.payment_expires_at > now:
                try:
                    intent = stripe.PaymentIntent.retrieve(pending.stripe_payment_intent_id)
                    if intent.status == 'succeeded':
                        result = _finalize_succeeded_ticket(pending, intent.id)
                        if result == 'paid':
                            return Response({
                                'alreadyPaid': True,
                                'ticket_id': pending.id,
                                'ticket': TicketSerializer(pending).data,
                            })
                        return Response(
                            {'error': 'A duplicate successful payment was refunded.'},
                            status=status.HTTP_400_BAD_REQUEST,
                        )
                    if intent.status not in ['canceled', 'succeeded']:
                        return Response(
                            {
                                'clientSecret': intent.client_secret,
                                'ticket_id': pending.id,
                                'reused': True,
                            }
                        )
                except Exception:
                    pass
            _cancel_pending_ticket(pending)

        ticket = Ticket.objects.create(
            user=request.user,
            event=event,
            seat_type=seat_type,
            price=price,
            payment_status='pending',
            payment_expires_at=now + PAYMENT_INTENT_TTL,
        )

        try:
            intent = stripe.PaymentIntent.create(
                amount=int(price * 100),
                currency='usd',
                metadata={'event_id': event_id, 'user_id': request.user.id, 'seat_type': seat_type, 'ticket_id': ticket.id},
                idempotency_key=f'stadium-ticket-{ticket.id}',
            )
            ticket.stripe_payment_intent_id = intent.id
            ticket.save(update_fields=['stripe_payment_intent_id'])
            return Response({'clientSecret': intent.client_secret, 'ticket_id': ticket.id, 'reused': False})
        except Exception as exc:
            ticket.payment_status = 'failed'
            ticket.payment_expires_at = None
            ticket.save(update_fields=['payment_status', 'payment_expires_at'])
            return Response({'error': str(exc)}, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def confirm_ticket(request):
    ticket_id = request.data.get('ticket_id')
    if not ticket_id:
        return Response({'error': 'ticket_id is required'}, status=status.HTTP_400_BAD_REQUEST)

    with transaction.atomic():
        User.objects.select_for_update().get(pk=request.user.pk)
        try:
            ticket = Ticket.objects.select_for_update().select_related('event').get(id=ticket_id, user=request.user)
        except Ticket.DoesNotExist:
            return Response({'error': 'Ticket not found'}, status=status.HTTP_404_NOT_FOUND)

        if ticket.payment_status == 'canceled':
            return Response({'error': 'This payment attempt was canceled.'}, status=status.HTTP_400_BAD_REQUEST)
        if ticket.payment_status == 'refunded':
            return Response({'error': 'This ticket was refunded.'}, status=status.HTTP_400_BAD_REQUEST)
        if ticket.event.status != 'approved':
            return Response({'error': 'This event is no longer approved.'}, status=status.HTTP_400_BAD_REQUEST)
        if ticket.event.date <= timezone.now():
            return Response({'error': 'This event has expired. Ticket confirmation is closed.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            intent = stripe.PaymentIntent.retrieve(ticket.stripe_payment_intent_id)
            if intent.status == 'succeeded':
                result = _finalize_succeeded_ticket(ticket, intent.id)
                if result == 'refunded':
                    return Response(
                        {'error': 'You already bought a ticket for this event. The duplicate payment was refunded.'},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
                return Response({'status': 'success', 'ticket': TicketSerializer(ticket).data})

            if intent.status == 'canceled':
                ticket.payment_status = 'canceled'
                ticket.canceled_at = timezone.now()
                ticket.payment_expires_at = None
                ticket.save(update_fields=['payment_status', 'canceled_at', 'payment_expires_at'])

            return Response(
                {'status': 'failed', 'message': f'Payment status is {intent.status}'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        except Exception as exc:
            return Response({'error': str(exc)}, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@permission_classes([permissions.AllowAny])
def stripe_webhook(request):
    if not settings.STRIPE_WEBHOOK_SECRET:
        return Response({'error': 'Stripe webhook is not configured.'}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

    try:
        event = stripe.Webhook.construct_event(
            request.body,
            request.headers.get('Stripe-Signature', ''),
            settings.STRIPE_WEBHOOK_SECRET,
        )
    except (ValueError, stripe.error.SignatureVerificationError):
        return Response({'error': 'Invalid webhook signature.'}, status=status.HTTP_400_BAD_REQUEST)

    if event.get('type') == 'payment_intent.succeeded':
        intent = event['data']['object']
        ticket_id = intent.get('metadata', {}).get('ticket_id')
        if ticket_id:
            with transaction.atomic():
                ticket = Ticket.objects.select_for_update().select_related('user', 'event').filter(
                    id=ticket_id,
                    stripe_payment_intent_id=intent['id'],
                ).first()
                if ticket:
                    _finalize_succeeded_ticket(ticket, intent['id'])

    return Response({'received': True})


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def cancel_payment_intent(request):
    ticket_id = request.data.get('ticket_id')
    if not ticket_id:
        return Response({'error': 'ticket_id is required'}, status=status.HTTP_400_BAD_REQUEST)

    with transaction.atomic():
        try:
            ticket = Ticket.objects.select_for_update().get(id=ticket_id, user=request.user)
        except Ticket.DoesNotExist:
            return Response({'error': 'Ticket not found'}, status=status.HTTP_404_NOT_FOUND)

        if ticket.is_paid or ticket.payment_status != 'pending':
            return Response({'error': 'Only pending payments can be canceled.'}, status=status.HTTP_400_BAD_REQUEST)
        _cancel_pending_ticket(ticket)
        return Response({'status': 'canceled'})


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def refund_ticket(request, ticket_id):
    if not _is_admin(request.user):
        raise PermissionDenied('Only admins can refund tickets.')

    with transaction.atomic():
        try:
            ticket = Ticket.objects.select_for_update().select_related('user', 'event').get(id=ticket_id)
        except Ticket.DoesNotExist:
            return Response({'error': 'Ticket not found'}, status=status.HTTP_404_NOT_FOUND)

        if not ticket.is_paid or ticket.payment_status != 'paid':
            return Response({'error': 'Only paid tickets can be refunded.'}, status=status.HTTP_400_BAD_REQUEST)
        if ticket.is_used:
            return Response({'error': 'Used tickets cannot be refunded.'}, status=status.HTTP_400_BAD_REQUEST)
        if not ticket.stripe_payment_intent_id:
            return Response({'error': 'Manual tickets do not have a Stripe payment to refund.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            refund = stripe.Refund.create(payment_intent=ticket.stripe_payment_intent_id, reason='requested_by_customer')
        except Exception as exc:
            return Response({'error': str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        ticket.is_paid = False
        ticket.payment_status = 'refunded'
        ticket.stripe_refund_id = refund.id
        ticket.refunded_at = timezone.now()
        ticket.qr_code_hash = None
        ticket.save(update_fields=['is_paid', 'payment_status', 'stripe_refund_id', 'refunded_at', 'qr_code_hash'])
        Notification.objects.create(
            user=ticket.user,
            title='Ticket Refunded',
            message=f'Your ticket for {ticket.event.title} was refunded.',
            type='warning',
        )
        return Response({'status': 'refunded', 'ticket': TicketSerializer(ticket).data})


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def my_tickets(request):
    tickets = Ticket.objects.filter(user=request.user, is_paid=True).order_by('-created_at')
    serializer = TicketSerializer(tickets, many=True)
    return Response(serializer.data)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def ticket_scan_access(request):
    if not _is_staff_or_admin(request.user):
        raise PermissionDenied('Only staff and admins can access ticket scanning.')
    if _is_admin(request.user):
        return Response({'allowed': True, 'role': 'admin', 'active_duties': []})

    now = timezone.now()
    duties = StaffDutyAssignment.objects.filter(
        staff=request.user,
        starts_at__lte=now,
        ends_at__gte=now,
        can_scan_tickets=True,
    ).select_related('event')
    next_duty = StaffDutyAssignment.objects.filter(
        staff=request.user,
        starts_at__gt=now,
        can_scan_tickets=True,
    ).order_by('starts_at').first()
    if duties.exists():
        message = 'Ticket scanning is enabled for your active duty.'
    elif next_duty:
        message = f'Your ticket-scanning duty starts at {timezone.localtime(next_duty.starts_at):%b %d, %Y %I:%M %p}.'
    else:
        message = 'You do not have an active ticket-scanning duty. Ask an admin to assign one.'

    return Response(
        {
            'allowed': duties.exists(),
            'role': 'staff',
            'active_duties': [
                {
                    'id': duty.id,
                    'title': duty.title,
                    'event_id': duty.event_id,
                    'event_title': duty.event.title if duty.event else None,
                    'ends_at': duty.ends_at,
                }
                for duty in duties
            ],
            'message': message,
        }
    )


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def verify_ticket(request):
    if not _is_staff_or_admin(request.user):
        raise PermissionDenied('Only staff and admins can verify tickets.')

    qr_code_hash = request.data.get('qr_code_hash')
    if not qr_code_hash:
        return Response({'error': 'qr_code_hash is required'}, status=status.HTTP_400_BAD_REQUEST)

    with transaction.atomic():
        try:
            ticket = Ticket.objects.select_for_update().select_related('event').get(qr_code_hash=qr_code_hash)
        except Ticket.DoesNotExist:
            TicketScan.objects.create(
                scanner=request.user,
                status='Invalid',
                message='Ticket not found or invalid QR code.',
            )
            return Response(
                {'status': 'Invalid', 'message': 'Ticket not found or invalid QR code.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        if not ticket.is_paid:
            _record_ticket_scan(request.user, ticket, 'Invalid', 'Ticket is not paid.')
            return Response({'status': 'Invalid', 'message': 'Ticket is not paid.'}, status=status.HTTP_400_BAD_REQUEST)

        if request.user.role == 'staff' and not _staff_has_active_permission(
            request.user, 'can_scan_tickets', ticket.event
        ):
            message = 'You need an active ticket-scanning duty for this event.'
            _record_ticket_scan(request.user, ticket, 'Access denied', message)
            return Response(
                {'status': 'Access denied', 'message': message, 'ticket': TicketSerializer(ticket).data},
                status=status.HTTP_403_FORBIDDEN,
            )

        if ticket.is_used:
            _record_ticket_scan(request.user, ticket, 'Duplicate', 'Ticket has already been scanned.')
            return Response(
                {
                    'status': 'Duplicate',
                    'message': 'Ticket has already been scanned.',
                    'ticket': TicketSerializer(ticket).data,
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        if ticket.event.status != 'approved':
            _record_ticket_scan(request.user, ticket, 'Revoked', 'This ticket event is no longer approved.')
            return Response(
                {
                    'status': 'Revoked',
                    'message': 'This ticket event is no longer approved.',
                    'ticket': TicketSerializer(ticket).data,
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        if ticket.event.date <= timezone.now():
            _record_ticket_scan(request.user, ticket, 'Expired', 'This ticket event has already ended.')
            return Response(
                {
                    'status': 'Expired',
                    'message': 'This ticket event has already ended.',
                    'ticket': TicketSerializer(ticket).data,
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        ticket.is_used = True
        ticket.used_at = timezone.now()
        ticket.save(update_fields=['is_used', 'used_at'])
        _record_ticket_scan(request.user, ticket, 'Valid', 'Ticket verified successfully.')

    return Response(
        {
            'status': 'Valid',
            'message': 'Ticket verified successfully.',
            'ticket': TicketSerializer(ticket).data,
        }
    )


def _record_ticket_scan(scanner, ticket, scan_status, message):
    TicketScan.objects.create(scanner=scanner, ticket=ticket, status=scan_status, message=message)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def recent_ticket_scans(request):
    if not _is_staff_or_admin(request.user):
        raise PermissionDenied('Only staff and admins can access ticket scans.')

    scans = TicketScan.objects.filter(scanner=request.user).select_related(
        'ticket__user', 'ticket__event'
    )[:50]
    return Response([
        {
            'id': scan.id,
            'ticket_id': scan.ticket_id,
            'status': scan.status,
            'message': scan.message,
            'holder': scan.ticket.user.username if scan.ticket else 'Unknown',
            'event': scan.ticket.event.title if scan.ticket else 'Unknown',
            'scanned_at': scan.scanned_at,
        }
        for scan in scans
    ])


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def staff_dashboard_stats(request):
    if not _is_staff_or_admin(request.user):
        raise PermissionDenied('Only staff and admins can access stats.')

    now = timezone.now()
    current_start = now - timedelta(days=7)
    previous_start = current_start - timedelta(days=7)
    paid_tickets = Ticket.objects.filter(is_paid=True)
    total_tickets = paid_tickets.count()
    total_revenue = paid_tickets.aggregate(Sum('price'))['price__sum'] or Decimal('0.00')
    upcoming_events = Event.objects.filter(date__gte=now, status='approved').count()

    recent_tickets = paid_tickets.select_related('user', 'event').order_by('-created_at')[:5]
    current_tickets = paid_tickets.filter(created_at__gte=current_start)
    previous_tickets = paid_tickets.filter(created_at__gte=previous_start, created_at__lt=current_start)
    current_revenue = current_tickets.aggregate(total=Sum('price'))['total'] or Decimal('0.00')
    previous_revenue = previous_tickets.aggregate(total=Sum('price'))['total'] or Decimal('0.00')

    current_events = Event.objects.filter(status='approved', date__gte=now, date__lt=now + timedelta(days=7)).count()
    previous_events = Event.objects.filter(status='approved', date__gte=now - timedelta(days=7), date__lt=now).count()

    duty_queryset = StaffDutyAssignment.objects.filter(staff=request.user) if request.user.role == 'staff' else StaffDutyAssignment.objects.all()
    current_duties = duty_queryset.filter(starts_at__gte=current_start, starts_at__lte=now).count()
    previous_duties = duty_queryset.filter(starts_at__gte=previous_start, starts_at__lt=current_start).count()

    daily_rows = (
        current_tickets.annotate(day=TruncDate('created_at'))
        .values('day')
        .annotate(tickets=Count('id'), revenue=Sum('price'))
    )
    daily_map = {row['day']: row for row in daily_rows}
    daily_activity = []
    for offset in range(7):
        day = (current_start + timedelta(days=offset)).date()
        row = daily_map.get(day)
        daily_activity.append({
            'date': day.isoformat(),
            'tickets': row['tickets'] if row else 0,
            'revenue': _to_float(row['revenue']) if row else 0,
        })

    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    monthly_start = (month_start - timedelta(days=70)).replace(day=1)
    monthly_rows = (
        paid_tickets.filter(created_at__gte=monthly_start)
        .annotate(month=TruncMonth('created_at'))
        .values('month')
        .annotate(revenue=Sum('price'), tickets=Count('id'))
        .order_by('month')
    )
    monthly_revenue = [
        {
            'month': row['month'].strftime('%Y-%m'),
            'revenue': _to_float(row['revenue']),
            'tickets': row['tickets'],
        }
        for row in monthly_rows
    ]

    recent_data = [
        {
            'id': ticket.id,
            'user': ticket.user.username,
            'event': ticket.event.title,
            'price': _to_float(ticket.price),
            'date': ticket.created_at,
        }
        for ticket in recent_tickets
    ]

    return Response(
        {
            'total_revenue': _to_float(total_revenue),
            'total_tickets': total_tickets,
            'upcoming_events': upcoming_events,
            'recent_tickets': recent_data,
            'trends': {
                'revenue': _period_change(current_revenue, previous_revenue),
                'tickets': _period_change(current_tickets.count(), previous_tickets.count()),
                'events': _period_change(current_events, previous_events),
                'duties': _period_change(current_duties, previous_duties),
            },
            'daily_activity': daily_activity,
            'monthly_revenue': monthly_revenue,
            'period': {
                'current_start': current_start,
                'current_end': now,
                'previous_start': previous_start,
                'previous_end': current_start,
            },
        }
    )


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def admin_dashboard_stats(request):
    if not _is_admin(request.user):
        raise PermissionDenied('Only admins can access this endpoint.')

    now = timezone.now()
    paid_tickets = Ticket.objects.filter(is_paid=True)
    total_revenue = paid_tickets.aggregate(Sum('price'))['price__sum'] or Decimal('0.00')
    current_start = now - timedelta(days=7)
    previous_start = current_start - timedelta(days=7)
    current_tickets = paid_tickets.filter(created_at__gte=current_start)
    previous_tickets = paid_tickets.filter(created_at__gte=previous_start, created_at__lt=current_start)
    current_revenue = current_tickets.aggregate(total=Sum('price'))['total'] or Decimal('0.00')
    previous_revenue = previous_tickets.aggregate(total=Sum('price'))['total'] or Decimal('0.00')

    last_7_days_start = now - timedelta(days=6)
    revenue_points = (
        paid_tickets.filter(created_at__date__gte=last_7_days_start.date())
        .annotate(day=TruncDate('created_at'))
        .values('day')
        .annotate(total=Sum('price'), tickets=Count('id'))
        .order_by('day')
    )

    revenue_map = {point['day']: point for point in revenue_points}
    sparkline = []
    for offset in range(7):
        current_day = (last_7_days_start + timedelta(days=offset)).date()
        point = revenue_map.get(current_day)
        sparkline.append({
            'day': current_day.isoformat(),
            'revenue': _to_float(point['total']) if point else 0,
            'tickets': point['tickets'] if point else 0,
        })

    current_customers = User.objects.filter(role='user', date_joined__gte=current_start).count()
    previous_customers = User.objects.filter(role='user', date_joined__gte=previous_start, date_joined__lt=current_start).count()
    current_approved_events = Event.objects.filter(status='approved', updated_at__gte=current_start).count()
    previous_approved_events = Event.objects.filter(status='approved', updated_at__gte=previous_start, updated_at__lt=current_start).count()
    current_manual_requests = ManualTicketRequest.objects.filter(created_at__gte=current_start).count()
    previous_manual_requests = ManualTicketRequest.objects.filter(created_at__gte=previous_start, created_at__lt=current_start).count()

    return Response(
        {
            'users_total': User.objects.filter(role='user').count(),
            'staff_total': User.objects.filter(role='staff').count(),
            'admins_total': User.objects.filter(role='admin').count(),
            'events_total': Event.objects.count(),
            'events_pending': Event.objects.filter(status='pending').count(),
            'events_approved': Event.objects.filter(status='approved').count(),
            'tickets_sold': paid_tickets.count(),
            'total_revenue': _to_float(total_revenue),
            'manual_pending': ManualTicketRequest.objects.filter(status='pending').count(),
            'revenue_sparkline': sparkline,
            'trends': {
                'revenue': _period_change(current_revenue, previous_revenue),
                'tickets': _period_change(current_tickets.count(), previous_tickets.count()),
                'customers': _period_change(current_customers, previous_customers),
                'approved_events': _period_change(current_approved_events, previous_approved_events),
                'manual_requests': _period_change(current_manual_requests, previous_manual_requests),
            },
            'period': {
                'current_start': current_start,
                'current_end': now,
            },
        }
    )


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def admin_financial_stats(request):
    if not _is_admin(request.user):
        raise PermissionDenied('Only admins can access this endpoint.')

    paid_tickets = Ticket.objects.filter(is_paid=True)

    total_revenue = paid_tickets.aggregate(Sum('price'))['price__sum'] or Decimal('0.00')
    total_tickets = paid_tickets.count()
    avg_ticket_price = (total_revenue / total_tickets) if total_tickets else Decimal('0.00')

    daily_start = timezone.now() - timedelta(days=13)
    daily_rows = (
        paid_tickets.filter(created_at__date__gte=daily_start.date())
        .annotate(day=TruncDate('created_at'))
        .values('day')
        .annotate(revenue=Sum('price'), tickets=Count('id'))
        .order_by('day')
    )

    daily_map = {row['day']: row for row in daily_rows}
    revenue_by_day = []
    for offset in range(14):
        current_day = (daily_start + timedelta(days=offset)).date()
        row = daily_map.get(current_day)
        revenue_by_day.append(
            {
                'date': current_day.isoformat(),
                'revenue': _to_float(row['revenue']) if row else 0,
                'tickets': row['tickets'] if row else 0,
            }
        )

    seat_rows = paid_tickets.values('seat_type').annotate(revenue=Sum('price'), tickets=Count('id')).order_by('seat_type')
    revenue_by_seat = [
        {
            'seat_type': row['seat_type'],
            'revenue': _to_float(row['revenue']),
            'tickets': row['tickets'],
        }
        for row in seat_rows
    ]

    monthly_rows = (
        paid_tickets.annotate(month=TruncMonth('created_at'))
        .values('month')
        .annotate(revenue=Sum('price'), tickets=Count('id'))
        .order_by('-month')[:6]
    )
    monthly_rows = list(reversed(monthly_rows))

    monthly_revenue = [
        {
            'month': row['month'].strftime('%Y-%m'),
            'revenue': _to_float(row['revenue']),
            'tickets': row['tickets'],
        }
        for row in monthly_rows
    ]

    top_events_rows = (
        paid_tickets.values('event_id', 'event__title')
        .annotate(revenue=Sum('price'), tickets=Count('id'))
        .order_by('-revenue')[:8]
    )
    top_events = [
        {
            'event_id': row['event_id'],
            'title': row['event__title'],
            'revenue': _to_float(row['revenue']),
            'tickets': row['tickets'],
        }
        for row in top_events_rows
    ]

    return Response(
        {
            'total_revenue': _to_float(total_revenue),
            'total_tickets': total_tickets,
            'average_ticket_price': _to_float(avg_ticket_price),
            'revenue_by_day': revenue_by_day,
            'revenue_by_seat': revenue_by_seat,
            'monthly_revenue': monthly_revenue,
            'top_events': top_events,
        }
    )


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def admin_report_stats(request):
    if not _is_admin(request.user):
        raise PermissionDenied('Only admins can access this endpoint.')

    now = timezone.now()
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    tickets_this_month = Ticket.objects.filter(is_paid=True, created_at__gte=month_start)
    tickets_used_this_month = Ticket.objects.filter(is_paid=True, is_used=True, used_at__gte=month_start)

    revenue_this_month = tickets_this_month.aggregate(Sum('price'))['price__sum'] or Decimal('0.00')

    event_performance_rows = (
        Ticket.objects.filter(is_paid=True)
        .values('event_id', 'event__title')
        .annotate(
            tickets_sold=Count('id'),
            revenue=Sum('price'),
        )
        .order_by('-revenue')[:10]
    )

    # Compute check-ins with a separate query for compatibility across Django versions.
    used_by_event = {
        row['event_id']: row['checkins']
        for row in Ticket.objects.filter(is_paid=True, is_used=True)
        .values('event_id')
        .annotate(checkins=Count('id'))
    }

    event_performance = [
        {
            'event_id': row['event_id'],
            'title': row['event__title'],
            'tickets_sold': row['tickets_sold'],
            'revenue': _to_float(row['revenue']),
            'checkins': used_by_event.get(row['event_id'], 0),
        }
        for row in event_performance_rows
    ]

    recent_manual_requests = ManualTicketRequest.objects.select_related(
        'requester', 'target_user', 'event'
    ).order_by('-created_at')[:8]
    manual_rows = [
        {
            'id': item.id,
            'requester': item.requester.username,
            'target_user': item.target_user.username,
            'target_full_name': item.target_full_name,
            'target_username': item.target_username,
            'event': item.event.title,
            'seat_type': item.seat_type,
            'status': item.status,
            'created_at': item.created_at,
        }
        for item in recent_manual_requests
    ]

    return Response(
        {
            'summary': {
                'tickets_this_month': tickets_this_month.count(),
                'revenue_this_month': _to_float(revenue_this_month),
                'checkins_this_month': tickets_used_this_month.count(),
                'pending_events': Event.objects.filter(status='pending').count(),
                'pending_manual_requests': ManualTicketRequest.objects.filter(status='pending').count(),
            },
            'event_performance': event_performance,
            'manual_requests': manual_rows,
        }
    )


def _calendar_item(kind, item, status_value='scheduled'):
    if kind == 'event':
        return {
            'id': f'event-{item.id}',
            'source_id': item.id,
            'type': 'event',
            'title': item.title,
            'starts_at': item.date,
            'ends_at': item.date + timedelta(hours=STADIUM_SLOT_HOURS),
            'status': item.status,
            'location': item.location,
            'owner': item.created_by.username,
        }

    if kind == 'booking':
        return {
            'id': f'booking-{item.id}',
            'source_id': item.id,
            'type': 'external_booking',
            'title': f'{item.team1_name} vs {item.team2_name}',
            'starts_at': item.scheduled_at,
            'ends_at': item.scheduled_at + timedelta(hours=STADIUM_SLOT_HOURS),
            'status': status_value,
            'location': 'Main stadium',
            'owner': item.organizer_name,
        }

    return {
        'id': f'duty-{item.id}',
        'source_id': item.id,
        'type': 'staff_duty',
        'title': item.title,
        'starts_at': item.starts_at,
        'ends_at': item.ends_at,
        'status': item.duty_type,
        'location': item.location,
        'owner': item.staff.username,
    }


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def schedule_calendar(request):
    if not _is_staff_or_admin(request.user):
        raise PermissionDenied('Only staff and admins can access the schedule.')

    events = Event.objects.select_related('created_by').exclude(status='rejected')
    bookings = ExternalStadiumBooking.objects.select_related('created_by')
    duties = StaffDutyAssignment.objects.select_related('staff', 'event', 'created_by')

    if request.user.role == 'staff':
        duties = duties.filter(staff=request.user)

    items = []
    items.extend(_calendar_item('event', event) for event in events)
    items.extend(_calendar_item('booking', booking) for booking in bookings)
    items.extend(_calendar_item('duty', duty) for duty in duties)
    items.sort(key=lambda item: item['starts_at'])

    now = timezone.now()
    upcoming = [item for item in items if item['ends_at'] >= now]
    past = [item for item in items if item['ends_at'] < now]

    return Response(
        {
            'items': items,
            'upcoming': upcoming[:50],
            'past': list(reversed(past[-50:])),
            'stadium_slot_hours': STADIUM_SLOT_HOURS,
        }
    )


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def stadium_availability(request):
    if not _is_staff_or_admin(request.user):
        raise PermissionDenied('Only staff and admins can check stadium availability.')

    scheduled_at = request.query_params.get('scheduled_at')
    if not scheduled_at:
        return Response({'detail': 'scheduled_at query parameter is required.'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        parsed = datetime.fromisoformat(scheduled_at.replace('Z', '+00:00'))
    except ValueError:
        return Response({'detail': 'scheduled_at must be a valid ISO date/time.'}, status=status.HTTP_400_BAD_REQUEST)
    if timezone.is_naive(parsed):
        parsed = timezone.make_aware(parsed, timezone.get_current_timezone())

    events, bookings = _stadium_clashes(parsed)
    clashes = [
        {
            'type': 'event',
            'id': event.id,
            'title': event.title,
            'scheduled_at': event.date,
            'status': event.status,
        }
        for event in events.select_related('created_by')
    ] + [
        {
            'type': 'external_booking',
            'id': booking.id,
            'title': f'{booking.team1_name} vs {booking.team2_name}',
            'scheduled_at': booking.scheduled_at,
            'status': 'booked',
        }
        for booking in bookings
    ]

    return Response(
        {
            'available': len(clashes) == 0,
            'scheduled_at': parsed,
            'slot_hours': STADIUM_SLOT_HOURS,
            'clashes': clashes,
        }
    )


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def event_history_report(request):
    if not _is_staff_or_admin(request.user):
        raise PermissionDenied('Only staff and admins can access event history.')

    event_rows = (
        Event.objects.select_related('created_by')
        .filter(Q(date__lt=timezone.now()) | Q(tickets__is_paid=True))
        .distinct()
        .order_by('-date')
    )

    paid_counts = {
        row['event_id']: row
        for row in Ticket.objects.filter(is_paid=True)
        .values('event_id')
        .annotate(tickets_sold=Count('id'), revenue=Sum('price'))
    }
    used_counts = {
        row['event_id']: row['attendance_count']
        for row in Ticket.objects.filter(is_paid=True, is_used=True)
        .values('event_id')
        .annotate(attendance_count=Count('id'))
    }

    records = []
    totals = {
        'events': 0,
        'attendance_count': 0,
        'tickets_sold': 0,
        'used_tickets': 0,
        'unused_tickets': 0,
        'revenue': Decimal('0.00'),
    }

    for event in event_rows:
        paid = paid_counts.get(event.id, {})
        tickets_sold = paid.get('tickets_sold', 0)
        revenue = paid.get('revenue') or Decimal('0.00')
        used_tickets = used_counts.get(event.id, 0)
        unused_tickets = max(tickets_sold - used_tickets, 0)

        records.append(
            {
                'event_id': event.id,
                'title': event.title,
                'date': event.date,
                'status': event.status,
                'attendance_count': used_tickets,
                'tickets_sold': tickets_sold,
                'used_tickets': used_tickets,
                'unused_tickets': unused_tickets,
                'revenue': _to_float(revenue),
                'created_by': event.created_by.username,
            }
        )

        totals['events'] += 1
        totals['attendance_count'] += used_tickets
        totals['tickets_sold'] += tickets_sold
        totals['used_tickets'] += used_tickets
        totals['unused_tickets'] += unused_tickets
        totals['revenue'] += revenue

    totals['revenue'] = _to_float(totals['revenue'])
    return Response({'summary': totals, 'records': records})
