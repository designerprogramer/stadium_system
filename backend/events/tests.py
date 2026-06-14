from datetime import timedelta
from types import SimpleNamespace
from unittest.mock import patch

from django.test import override_settings
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.models import StaffDutyAssignment, User

from .models import Event, ExternalStadiumBooking, ManualTicketRequest, Ticket, TicketScan


class PublicUpcomingEventTests(APITestCase):
    def test_public_feed_only_returns_approved_future_events(self):
        admin = User.objects.create_user(username='public-event-admin', password='pass', role='admin')
        visible = Event.objects.create(
            title='Visible Final',
            description='Approved future event',
            date=timezone.now() + timedelta(days=2),
            location='Mogadishu Stadium',
            status='approved',
            created_by=admin,
        )
        Event.objects.create(
            title='Pending Match',
            description='Pending event',
            date=timezone.now() + timedelta(days=3),
            location='Mogadishu Stadium',
            status='pending',
            created_by=admin,
        )
        Event.objects.create(
            title='Past Match',
            description='Past event',
            date=timezone.now() - timedelta(days=1),
            location='Mogadishu Stadium',
            status='approved',
            created_by=admin,
        )

        response = self.client.get(reverse('public_upcoming_events'))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual([item['id'] for item in response.data], [visible.id])
        self.assertNotIn('created_by', response.data[0])


class ExternalStadiumBookingTests(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_user(username='admin-bookings', password='pass', role='admin')
        self.staff = User.objects.create_user(username='staff-bookings', password='pass', role='staff')
        self.customer = User.objects.create_user(username='customer-bookings', password='pass', role='user')
        self.url = reverse('external_stadium_bookings')
        self.payload = {
            'organizer_name': 'Community Sports Club',
            'contact_phone': '+252610000000',
            'team1_name': 'Blue Stars',
            'team2_name': 'Red Stars',
            'scheduled_at': (timezone.now() + timedelta(days=7)).isoformat(),
            'amount_paid': '500.00',
            'payment_reference': 'PAY-100',
            'notes': 'Non-Champions-League match',
        }
        StaffDutyAssignment.objects.create(
            staff=self.staff,
            duty_type='maintenance',
            title='Booking desk',
            starts_at=timezone.now() - timedelta(hours=1),
            ends_at=timezone.now() + timedelta(hours=1),
            can_manage_bookings=True,
            created_by=self.admin,
        )

    def test_staff_can_register_paid_external_booking(self):
        self.client.force_authenticate(self.staff)

        response = self.client.post(self.url, self.payload, format='json')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        booking = ExternalStadiumBooking.objects.get()
        self.assertEqual(booking.created_by, self.staff)
        self.assertEqual(str(booking.amount_paid), '500.00')

    def test_admin_can_view_staff_booking(self):
        self.client.force_authenticate(self.staff)
        self.client.post(self.url, self.payload, format='json')
        self.client.force_authenticate(self.admin)

        response = self.client.get(self.url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)

    def test_customer_cannot_register_external_booking(self):
        self.client.force_authenticate(self.customer)

        response = self.client.post(self.url, self.payload, format='json')

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_customer_cannot_view_external_bookings(self):
        self.client.force_authenticate(self.customer)

        response = self.client.get(self.url)

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_staff_without_booking_duty_cannot_register_booking(self):
        other_staff = User.objects.create_user(username='staff-no-booking-duty', password='pass', role='staff')
        self.client.force_authenticate(other_staff)

        response = self.client.post(self.url, self.payload, format='json')

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_booking_requires_positive_payment(self):
        self.client.force_authenticate(self.admin)
        invalid_payload = {**self.payload, 'amount_paid': '0.00'}

        response = self.client.post(self.url, invalid_payload, format='json')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('amount_paid', response.data)

    def test_booking_requires_different_names(self):
        self.client.force_authenticate(self.admin)
        invalid_payload = {**self.payload, 'team2_name': 'blue stars'}

        response = self.client.post(self.url, invalid_payload, format='json')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('team2_name', response.data)


class TicketVerificationTests(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_user(username='admin-scanner', password='pass', role='admin')
        self.staff = User.objects.create_user(username='staff-scanner', password='pass', role='staff')
        self.customer = User.objects.create_user(username='customer-scanner', password='pass', role='user')
        self.url = reverse('verify_ticket')
        self.event = Event.objects.create(
            title='Future Match',
            description='A future stadium event.',
            date=timezone.now() + timedelta(days=1),
            location='Main Stadium',
            status='approved',
            created_by=self.admin,
        )
        StaffDutyAssignment.objects.create(
            staff=self.staff,
            event=self.event,
            duty_type='ticket_scanning',
            title='Gate scanner',
            starts_at=timezone.now() - timedelta(hours=1),
            ends_at=timezone.now() + timedelta(hours=1),
            can_scan_tickets=True,
            created_by=self.admin,
        )

    def make_ticket(self, **overrides):
        data = {
            'user': self.customer,
            'event': self.event,
            'seat_type': 'Normal',
            'price': '1.00',
            'is_paid': True,
            'qr_code_hash': 'qr-valid-hash',
        }
        data.update(overrides)
        return Ticket.objects.create(**data)

    def test_staff_can_verify_paid_unused_ticket(self):
        ticket = self.make_ticket()
        self.client.force_authenticate(self.staff)

        response = self.client.post(self.url, {'qr_code_hash': ticket.qr_code_hash}, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['status'], 'Valid')
        ticket.refresh_from_db()
        self.assertTrue(ticket.is_used)
        self.assertIsNotNone(ticket.used_at)

    def test_duplicate_scan_is_rejected(self):
        ticket = self.make_ticket(is_used=True, used_at=timezone.now())
        self.client.force_authenticate(self.staff)

        response = self.client.post(self.url, {'qr_code_hash': ticket.qr_code_hash}, format='json')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data['status'], 'Duplicate')

    def test_expired_event_ticket_is_rejected_and_not_used(self):
        expired_event = Event.objects.create(
            title='Past Match',
            description='An old stadium event.',
            date=timezone.now() - timedelta(hours=1),
            location='Main Stadium',
            status='approved',
            created_by=self.admin,
        )
        ticket = self.make_ticket(event=expired_event, qr_code_hash='qr-expired-hash')
        StaffDutyAssignment.objects.create(
            staff=self.staff,
            event=expired_event,
            duty_type='ticket_scanning',
            title='Past gate scanner',
            starts_at=timezone.now() - timedelta(hours=2),
            ends_at=timezone.now() + timedelta(hours=1),
            can_scan_tickets=True,
            created_by=self.admin,
        )
        self.client.force_authenticate(self.staff)

        response = self.client.post(self.url, {'qr_code_hash': ticket.qr_code_hash}, format='json')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data['status'], 'Expired')
        ticket.refresh_from_db()
        self.assertFalse(ticket.is_used)
        self.assertIsNone(ticket.used_at)

    def test_unpaid_ticket_is_rejected(self):
        ticket = self.make_ticket(is_paid=False, qr_code_hash='qr-unpaid-hash')
        self.client.force_authenticate(self.staff)

        response = self.client.post(self.url, {'qr_code_hash': ticket.qr_code_hash}, format='json')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data['status'], 'Invalid')

    def test_revoked_event_ticket_is_rejected_and_not_used(self):
        self.event.status = 'rejected'
        self.event.save(update_fields=['status'])
        ticket = self.make_ticket(qr_code_hash='qr-revoked-hash')
        self.client.force_authenticate(self.staff)

        response = self.client.post(self.url, {'qr_code_hash': ticket.qr_code_hash}, format='json')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data['status'], 'Revoked')
        ticket.refresh_from_db()
        self.assertFalse(ticket.is_used)

    def test_invalid_qr_is_rejected(self):
        self.client.force_authenticate(self.staff)

        response = self.client.post(self.url, {'qr_code_hash': 'missing-hash'}, format='json')

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(response.data['status'], 'Invalid')

    def test_customer_cannot_verify_ticket(self):
        ticket = self.make_ticket()
        self.client.force_authenticate(self.customer)

        response = self.client.post(self.url, {'qr_code_hash': ticket.qr_code_hash}, format='json')

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_staff_without_active_scan_duty_is_rejected(self):
        other_staff = User.objects.create_user(username='staff-no-duty', password='pass', role='staff')
        ticket = self.make_ticket(qr_code_hash='qr-no-duty')
        self.client.force_authenticate(other_staff)

        response = self.client.post(self.url, {'qr_code_hash': ticket.qr_code_hash}, format='json')

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_scan_access_reports_active_duty(self):
        self.client.force_authenticate(self.staff)

        response = self.client.get(reverse('ticket_scan_access'))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['allowed'])
        self.assertEqual(len(response.data['active_duties']), 1)

    def test_scan_access_reports_missing_duty(self):
        other_staff = User.objects.create_user(username='staff-no-scan-access', password='pass', role='staff')
        self.client.force_authenticate(other_staff)

        response = self.client.get(reverse('ticket_scan_access'))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(response.data['allowed'])

    def test_scan_attempt_is_saved_and_available_after_refresh(self):
        ticket = self.make_ticket()
        self.client.force_authenticate(self.staff)
        self.client.post(self.url, {'qr_code_hash': ticket.qr_code_hash}, format='json')

        response = self.client.get(reverse('recent_ticket_scans'))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data[0]['ticket_id'], ticket.id)
        self.assertEqual(response.data[0]['status'], 'Valid')
        self.assertEqual(TicketScan.objects.filter(scanner=self.staff).count(), 1)

    def test_invalid_scan_is_saved_in_recent_history(self):
        self.client.force_authenticate(self.staff)

        self.client.post(self.url, {'qr_code_hash': 'not-a-ticket'}, format='json')
        response = self.client.get(reverse('recent_ticket_scans'))

        self.assertEqual(response.data[0]['ticket_id'], None)
        self.assertEqual(response.data[0]['status'], 'Invalid')


class TicketLifecycleTests(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_user(username='admin-lifecycle', password='pass', role='admin')
        self.staff = User.objects.create_user(username='staff-lifecycle', password='pass', role='staff')
        self.customer = User.objects.create_user(username='customer-lifecycle', password='pass', role='user')
        self.future_event = Event.objects.create(
            title='Lifecycle Match',
            description='A future event.',
            date=timezone.now() + timedelta(days=1),
            location='Main Stadium',
            status='approved',
            created_by=self.admin,
        )
        self.expired_event = Event.objects.create(
            title='Expired Lifecycle Match',
            description='A past event.',
            date=timezone.now() - timedelta(hours=1),
            location='Main Stadium',
            status='approved',
            created_by=self.admin,
        )
        StaffDutyAssignment.objects.create(
            staff=self.staff,
            duty_type='customer_support',
            title='Manual ticket desk',
            starts_at=timezone.now() - timedelta(hours=1),
            ends_at=timezone.now() + timedelta(hours=1),
            can_assign_manual_tickets=True,
            created_by=self.admin,
        )

    def test_expired_ticket_cannot_be_confirmed(self):
        ticket = Ticket.objects.create(
            user=self.customer,
            event=self.expired_event,
            seat_type='Normal',
            price='1.00',
            stripe_payment_intent_id='pi_expired',
        )
        self.client.force_authenticate(self.customer)

        response = self.client.post(reverse('confirm_ticket'), {'ticket_id': ticket.id}, format='json')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('expired', response.data['error'].lower())
        ticket.refresh_from_db()
        self.assertFalse(ticket.is_paid)

    def test_staff_cannot_request_manual_ticket_for_expired_event(self):
        self.client.force_authenticate(self.staff)

        response = self.client.post(
            reverse('manual_ticket_requests'),
            {
                'target_full_name': 'Customer Lifecycle',
                'target_username': self.customer.username,
                'event': self.expired_event.id,
                'seat_type': 'Normal',
                'reason': 'Late request',
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('event', response.data)

    def test_staff_cannot_request_second_ticket_for_owner(self):
        Ticket.objects.create(
            user=self.customer,
            event=self.future_event,
            seat_type='Normal',
            price='1.00',
            is_paid=True,
            qr_code_hash='owned-ticket',
        )
        self.client.force_authenticate(self.staff)

        response = self.client.post(
            reverse('manual_ticket_requests'),
            {
                'target_full_name': 'Customer Lifecycle',
                'target_username': self.customer.username,
                'event': self.future_event.id,
                'seat_type': 'VIP',
                'reason': 'Duplicate request',
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('already has a ticket', str(response.data))

    def test_admin_cannot_approve_manual_request_after_event_expires(self):
        manual_request = ManualTicketRequest.objects.create(
            requester=self.staff,
            target_username=self.customer.username,
            target_full_name='Customer Lifecycle',
            target_user=self.customer,
            event=self.expired_event,
            seat_type='Normal',
        )
        self.client.force_authenticate(self.admin)

        response = self.client.patch(
            reverse('manual_ticket_request_review', kwargs={'pk': manual_request.id}),
            {'status': 'approved'},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('expired', response.data['detail'].lower())
        manual_request.refresh_from_db()
        self.assertEqual(manual_request.status, 'pending')
        self.assertIsNone(manual_request.ticket)

    @override_settings(STRIPE_SECRET_KEY='')
    def test_payment_intent_requires_stripe_configuration(self):
        self.client.force_authenticate(self.customer)

        response = self.client.post(
            reverse('create_payment_intent'),
            {'event_id': self.future_event.id, 'seat_type': 'Normal'},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)
        self.assertIn('Stripe is not configured', response.data['error'])
        self.assertFalse(Ticket.objects.filter(user=self.customer, event=self.future_event).exists())

    @override_settings(STRIPE_SECRET_KEY='sk_test_configured')
    @patch('events.views.stripe.PaymentIntent.retrieve')
    @patch('events.views.stripe.PaymentIntent.create')
    def test_live_pending_payment_intent_is_reused(self, create_intent, retrieve_intent):
        create_intent.return_value = SimpleNamespace(id='pi_reuse', client_secret='secret_reuse')
        retrieve_intent.return_value = SimpleNamespace(
            id='pi_reuse',
            client_secret='secret_reuse',
            status='requires_payment_method',
        )
        self.client.force_authenticate(self.customer)
        url = reverse('create_payment_intent')
        payload = {'event_id': self.future_event.id, 'seat_type': 'Normal'}

        first = self.client.post(url, payload, format='json')
        second = self.client.post(url, payload, format='json')

        self.assertEqual(first.status_code, status.HTTP_200_OK)
        self.assertEqual(second.status_code, status.HTTP_200_OK)
        self.assertFalse(first.data['reused'])
        self.assertTrue(second.data['reused'])
        self.assertEqual(first.data['ticket_id'], second.data['ticket_id'])
        self.assertEqual(create_intent.call_count, 1)

    @patch('events.views.stripe.PaymentIntent.cancel')
    def test_customer_can_cancel_pending_payment(self, cancel_intent):
        ticket = Ticket.objects.create(
            user=self.customer,
            event=self.future_event,
            seat_type='Normal',
            price='1.00',
            payment_status='pending',
            payment_expires_at=timezone.now() + timedelta(minutes=30),
            stripe_payment_intent_id='pi_cancel',
        )
        self.client.force_authenticate(self.customer)

        response = self.client.post(reverse('cancel_payment_intent'), {'ticket_id': ticket.id}, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        ticket.refresh_from_db()
        self.assertEqual(ticket.payment_status, 'canceled')
        cancel_intent.assert_called_once_with('pi_cancel')

    @override_settings(STRIPE_SECRET_KEY='sk_test_configured')
    @patch('events.views.stripe.PaymentIntent.create')
    @patch('events.views.stripe.PaymentIntent.retrieve')
    def test_successful_abandoned_payment_is_recovered(self, retrieve_intent, create_intent):
        ticket = Ticket.objects.create(
            user=self.customer,
            event=self.future_event,
            seat_type='Normal',
            price='1.00',
            payment_status='pending',
            payment_expires_at=timezone.now() + timedelta(minutes=30),
            stripe_payment_intent_id='pi_succeeded',
        )
        retrieve_intent.return_value = SimpleNamespace(
            id='pi_succeeded',
            client_secret='secret_succeeded',
            status='succeeded',
        )
        self.client.force_authenticate(self.customer)

        response = self.client.post(
            reverse('create_payment_intent'),
            {'event_id': self.future_event.id, 'seat_type': 'Normal'},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['alreadyPaid'])
        ticket.refresh_from_db()
        self.assertTrue(ticket.is_paid)
        self.assertEqual(ticket.payment_status, 'paid')
        self.assertTrue(ticket.qr_code_hash)
        create_intent.assert_not_called()

    @override_settings(STRIPE_WEBHOOK_SECRET='whsec_test')
    @patch('events.views.stripe.Webhook.construct_event')
    def test_stripe_webhook_finalizes_ticket_when_browser_disappears(self, construct_event):
        ticket = Ticket.objects.create(
            user=self.customer,
            event=self.future_event,
            seat_type='Normal',
            price='1.00',
            payment_status='pending',
            payment_expires_at=timezone.now() + timedelta(minutes=30),
            stripe_payment_intent_id='pi_webhook',
        )
        construct_event.return_value = {
            'type': 'payment_intent.succeeded',
            'data': {'object': {'id': 'pi_webhook', 'metadata': {'ticket_id': str(ticket.id)}}},
        }

        response = self.client.post(
            reverse('stripe_webhook'),
            data={},
            format='json',
            HTTP_STRIPE_SIGNATURE='test-signature',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        ticket.refresh_from_db()
        self.assertTrue(ticket.is_paid)
        self.assertEqual(ticket.payment_status, 'paid')

    @patch('events.views.stripe.Refund.create')
    def test_admin_can_refund_unused_paid_ticket(self, create_refund):
        create_refund.return_value = SimpleNamespace(id='re_123')
        ticket = Ticket.objects.create(
            user=self.customer,
            event=self.future_event,
            seat_type='Normal',
            price='1.00',
            is_paid=True,
            payment_status='paid',
            qr_code_hash='refund-qr',
            stripe_payment_intent_id='pi_refund',
        )
        self.client.force_authenticate(self.admin)

        response = self.client.post(reverse('refund_ticket', kwargs={'ticket_id': ticket.id}), format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        ticket.refresh_from_db()
        self.assertFalse(ticket.is_paid)
        self.assertEqual(ticket.payment_status, 'refunded')
        self.assertIsNone(ticket.qr_code_hash)
