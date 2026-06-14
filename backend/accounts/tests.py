from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase
from django.utils import timezone
from datetime import timedelta

from .models import Notification, SupportConversation, SupportMessage, User
from events.models import Event, Ticket


class SupportWorkflowTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='support-customer', password='pass', role='user')
        self.staff = User.objects.create_user(username='support-staff', password='pass', role='staff')
        self.admin = User.objects.create_user(username='support-admin', password='pass', role='admin')

    def test_ticket_question_creates_staff_conversation(self):
        self.client.force_authenticate(self.user)

        response = self.client.post('/api/support/my-conversation/messages/', {'message': 'My ticket QR is not working.'})

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        conversation = SupportConversation.objects.get()
        self.assertEqual(conversation.category, 'ticket')
        self.assertEqual(conversation.assigned_role, 'staff')
        self.assertEqual(conversation.assigned_to, self.staff)
        self.assertEqual(conversation.priority, 'high')
        self.assertEqual(SupportMessage.objects.get().sender, self.user)

    def test_payment_question_is_assigned_to_staff_first(self):
        self.client.force_authenticate(self.user)

        response = self.client.post('/api/support/my-conversation/messages/', {'message': 'I need a payment refund.'})

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        conversation = SupportConversation.objects.get()
        self.assertEqual(conversation.category, 'payment')
        self.assertEqual(conversation.assigned_role, 'staff')
        self.assertEqual(conversation.assigned_to, self.staff)

    def test_chatbot_lists_live_approved_upcoming_events(self):
        Event.objects.create(
            title='City Final',
            description='Final match',
            date=timezone.now() + timedelta(days=2),
            location='North Stadium',
            status='approved',
            created_by=self.admin,
        )
        self.client.force_authenticate(self.user)

        response = self.client.post('/api/support/chatbot/', {'message': 'Which events are available?'})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('City Final', response.data['answer'])
        self.assertFalse(response.data['support_created'])
        self.assertFalse(SupportConversation.objects.exists())

    def test_chatbot_confirms_paid_ticket_without_creating_case(self):
        event = Event.objects.create(
            title='Paid Match',
            description='Paid match',
            date=timezone.now() + timedelta(days=2),
            location='Main Stadium',
            status='approved',
            created_by=self.admin,
        )
        Ticket.objects.create(
            user=self.user,
            event=event,
            seat_type='Normal',
            price='1.00',
            is_paid=True,
            payment_status='paid',
        )
        self.client.force_authenticate(self.user)

        response = self.client.post('/api/support/chatbot/', {'message': "I paid but didn't get ticket"})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('confirmed as paid', response.data['answer'])
        self.assertFalse(response.data['support_created'])

    def test_chatbot_creates_staff_case_for_deducted_money(self):
        self.client.force_authenticate(self.user)

        response = self.client.post('/api/support/chatbot/', {'message': 'My money was deducted'})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['support_created'])
        conversation = SupportConversation.objects.get()
        self.assertEqual(conversation.category, 'payment')
        self.assertEqual(conversation.assigned_role, 'staff')
        self.assertEqual(conversation.assigned_to, self.staff)

    def test_staff_can_escalate_support_case_to_admin(self):
        conversation = SupportConversation.objects.create(
            user=self.user,
            assigned_to=self.staff,
            assigned_role='staff',
            status='assigned',
            category='payment',
        )
        self.client.force_authenticate(self.staff)

        response = self.client.patch(f'/api/support/conversations/{conversation.id}/escalate/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        conversation.refresh_from_db()
        self.assertEqual(conversation.assigned_role, 'admin')
        self.assertEqual(conversation.assigned_to, self.admin)
        self.assertTrue(Notification.objects.filter(user=self.user, title='Your issue was escalated').exists())

    def test_staff_reply_notifies_customer(self):
        conversation = SupportConversation.objects.create(
            user=self.user,
            assigned_to=self.staff,
            assigned_role='staff',
            status='assigned',
            category='ticket',
        )
        self.client.force_authenticate(self.staff)

        response = self.client.post(
            f'/api/support/conversations/{conversation.id}/messages/',
            {'message': 'Please try the refreshed QR pass.'},
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(Notification.objects.filter(user=self.user, title='Support replied').exists())

    def test_customer_cannot_read_another_customers_conversation(self):
        other_user = User.objects.create_user(username='other-customer', password='pass', role='user')
        conversation = SupportConversation.objects.create(user=other_user, assigned_role='staff')
        self.client.force_authenticate(self.user)

        response = self.client.get(f'/api/support/conversations/{conversation.id}/')

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
