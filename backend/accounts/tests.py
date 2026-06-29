from unittest.mock import patch

from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase
from django.utils import timezone
from datetime import timedelta

from .models import Notification, RegistrationRequest, SupportConversation, SupportMessage, User
from events.models import Event, Ticket


class AuthenticationFlowTests(APITestCase):
    def test_pending_registration_login_explains_email_verification(self):
        RegistrationRequest.objects.create(
            username='pending-user',
            email='pending@example.com',
            password='hashed-password',
            otp='123456',
            otp_expires_at=timezone.now() + timedelta(minutes=15),
        )

        response = self.client.post(
            '/api/login/user/',
            {'username': 'pending-user', 'password': 'password'},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertIn('pending email verification', response.data['detail'])

    @patch('accounts.views.send_otp_email', side_effect=OSError('SMTP unavailable'))
    def test_registration_returns_clear_error_when_otp_email_fails(self, send_email):
        response = self.client.post(
            '/api/register/',
            {
                'username': 'email-failure-user',
                'email': 'email-failure@example.com',
                'password': 'strong-password-123',
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)
        self.assertIn('OTP email could not be sent', response.data['detail'])
        self.assertFalse(RegistrationRequest.objects.filter(username='email-failure-user').exists())


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

    @patch('accounts.views.google_translate')
    def test_chatbot_somali_query_translates_and_replies_somali(self, mock_translate):
        mock_translate.side_effect = [
            ("how much is ticket price", "so"),
            ("Qiimaha tigidhadu waa $1.00 kursiga caadiga ah (Normal seat) iyo $3.00 kursiga VIP-da ah.", "so")
        ]
        self.client.force_authenticate(self.user)
        response = self.client.post('/api/support/chatbot/', {'message': 'qiimaha tikidhada waa meeqo?'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('Qiimaha', response.data['answer'])
        self.assertFalse(response.data['support_created'])

    @patch('accounts.views.google_translate')
    def test_chatbot_translation_failure_falls_back_to_hardcoded_somali(self, mock_translate):
        mock_translate.return_value = (None, None)
        self.client.force_authenticate(self.user)
        response = self.client.post('/api/support/chatbot/', {'message': 'qiimaha'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('Qiimaha tigidhadu waa', response.data['answer'])
        self.assertFalse(response.data['support_created'])

    @patch('accounts.views.google_translate')
    def test_chatbot_english_query_stays_english(self, mock_translate):
        mock_translate.return_value = ("how much is ticket price", "en")
        self.client.force_authenticate(self.user)
        response = self.client.post('/api/support/chatbot/', {'message': 'how much is ticket price'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('Ticket prices are', response.data['answer'])
        self.assertFalse(response.data['support_created'])

    @patch('accounts.views.google_translate')
    def test_chatbot_somali_buying_query_matches_how_to_buy(self, mock_translate):
        mock_translate.side_effect = [
            ("can i buy a ticket now?", "so"),
            ("Fur Dhacdooyinka (Events), dooro dhacdo la ansixiyay, dooro Normal ama VIP, ka dibna dhammaystir bixinta lacagta. Ka dib marka lacag-bixintu guulaysato, tigidhkaaga QR wuxuu ka soo muuqan doonaa Passes.", "so")
        ]
        self.client.force_authenticate(self.user)
        response = self.client.post('/api/support/chatbot/', {'message': 'hada ticket ma iibsan karaa'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('dhacdooyinka', response.data['answer'].lower())
        self.assertFalse(response.data['support_created'])

    @patch('accounts.views.google_translate')
    def test_chatbot_somali_acknowledgement_matches_ack_flow(self, mock_translate):
        mock_translate.side_effect = [
            ("ok then i can buy yes is the answer ticket i can buy", "so"),
            ("Aad u wanaagsan! Fadlan ii sheeg haddii aad u baahan tahay caawimaad kale.", "so")
        ]
        self.client.force_authenticate(self.user)
        response = self.client.post('/api/support/chatbot/', {'message': 'ok markas waa iibsankara haa waye jawabta ticket waan iibsnkara'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('aad u wanaagsan', response.data['answer'].lower())
        self.assertFalse(response.data['support_created'])

    @patch('accounts.views.google_translate')
    def test_chatbot_somali_yes_no_question_prefixes_correctly(self, mock_translate):
        mock_translate.side_effect = [
            ("can i scan ticket?", "so"),
            ("Maya. Skaan-raynta tigidhadu waxay u xirantahay oo kaliya shaqaalaha la ogolaaday. Adiga oo ah macmiil, fur Passes oo tus code-kaaga QR shaqaalaha jooga albaabka.", "so")
        ]
        self.client.force_authenticate(self.user)
        response = self.client.post('/api/support/chatbot/', {'message': 'ma skaan gareyn karaa ticket?'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['answer'].startswith('Maya.'))
        self.assertFalse(response.data['support_created'])

    def test_chatbot_expired_ticket_query_returns_expired_rule(self):
        self.client.force_authenticate(self.user)
        response = self.client.post('/api/support/chatbot/', {'message': 'qrcode tciket hadii expired noqdo mageli event ?'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('Maya!', response.data['answer'])
        self.assertIn('expired', response.data['answer'].lower())
        self.assertNotIn('Here are the next available events', response.data['answer'])






