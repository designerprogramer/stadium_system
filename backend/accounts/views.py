from datetime import timedelta
import logging

from django.conf import settings
from django.contrib.auth.hashers import make_password
from django.core.mail import send_mail
from django.db import transaction
from django.db.models import Count, Q
from django.utils import timezone
from rest_framework import generics, permissions, status, viewsets
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.exceptions import APIException
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView

from events.models import Event, Ticket

from .models import Notification, OTP, RegistrationRequest, StaffDutyAssignment, SupportConversation, SupportMessage, User, TeamChatMessage, TeamChatReadState
from .serializers import (
    AdminUserManagementSerializer,
    ChangePasswordSerializer,
    NotificationSerializer,
    RegisterSerializer,
    RoleTokenObtainPairSerializer,
    StaffDutyAssignmentSerializer,
    SupportConversationDetailSerializer,
    SupportConversationListSerializer,
    TeamChatMessageSerializer,
    UserDirectorySerializer,
    UserProfileSerializer,
)

logger = logging.getLogger(__name__)


class EmailDeliveryUnavailable(APIException):
    status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    default_detail = 'Account creation failed because the OTP email could not be sent. Please try again later.'
    default_code = 'email_delivery_unavailable'


def send_otp_email(email, code, subject):
    if settings.EMAIL_HOST.lower() == 'smtp.gmail.com' and (
        not settings.EMAIL_HOST_USER or not settings.EMAIL_HOST_PASSWORD
    ):
        raise RuntimeError('SMTP email credentials are not configured.')

    message = f"Your stadium system OTP is {code}. It is valid for 15 minutes."
    send_mail(
        subject,
        message,
        settings.DEFAULT_FROM_EMAIL,
        [email],
        fail_silently=False,
    )


def get_active_otp(user, purpose, code):
    return (
        OTP.objects.filter(
            user=user,
            purpose=purpose,
            code=code,
            used=False,
            expires_at__gte=timezone.now(),
        )
        .order_by('-created_at')
        .first()
    )


class IsAdminRole(permissions.BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.role == 'admin')


class IsStaffOrAdminRole(permissions.BasePermission):
    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.role in ['staff', 'admin']
        )


class RegisterView(generics.CreateAPIView):
    serializer_class = RegisterSerializer

    @transaction.atomic
    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.save()
        otp = OTP.generate_code()
        expires_at = timezone.now() + timedelta(minutes=15)

        RegistrationRequest.objects.update_or_create(
            email=data['email'],
            defaults={
                'username': data['username'],
                'password': make_password(data['password']),
                'otp': otp,
                'otp_expires_at': expires_at,
                'verified': False,
            },
        )

        try:
            send_otp_email(data['email'], otp, 'Stadium System Registration OTP')
        except Exception as exc:
            logger.exception('Registration OTP email delivery failed')
            raise EmailDeliveryUnavailable() from exc

        return Response(
            {
                'detail': 'Registration request received. An OTP was sent to your email.',
            },
            status=status.HTTP_201_CREATED,
        )


class VerifyRegisterOtpView(APIView):
    permission_classes = [AllowAny]

    @transaction.atomic
    def post(self, request):
        email = request.data.get('email')
        otp_code = request.data.get('otp')

        if not email or not otp_code:
            return Response(
                {'detail': 'Email and OTP are required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        reg_request = RegistrationRequest.objects.filter(
            email=email,
            otp=otp_code,
            verified=False,
            otp_expires_at__gte=timezone.now(),
        ).first()
        if not reg_request:
            return Response(
                {'detail': 'Invalid or expired OTP.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if User.objects.filter(username=reg_request.username).exists() or User.objects.filter(email=email).exists():
            return Response(
                {'detail': 'This account already exists.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user = User(
            username=reg_request.username,
            email=reg_request.email,
            role='user',
            is_active=True,
        )
        user.password = reg_request.password
        user.save()
        reg_request.verified = True
        reg_request.save()

        return Response({'detail': 'Registration verified. You can now log in.'})


class ForgotPasswordView(APIView):
    permission_classes = [AllowAny]

    @transaction.atomic
    def post(self, request):
        email = request.data.get('email')
        if not email:
            return Response(
                {'detail': 'Email is required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user = User.objects.filter(email=email, is_active=True).first()
        if user:
            otp = OTP.create_for_user(user, 'password_reset')
            send_otp_email(user.email, otp.code, 'Stadium System Password Reset OTP')

        return Response(
            {
                'detail': 'If an account exists for this email, an OTP has been sent.',
            }
        )


class VerifyPasswordOtpView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        email = request.data.get('email')
        otp_code = request.data.get('otp')

        if not email or not otp_code:
            return Response(
                {'detail': 'Email and OTP are required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user = User.objects.filter(email=email, is_active=True).first()
        if not user:
            return Response(
                {'detail': 'Invalid email or OTP.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        otp = get_active_otp(user, 'password_reset', otp_code)
        if not otp:
            return Response(
                {'detail': 'Invalid or expired OTP.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response({'detail': 'OTP verified. You may reset your password.'})


class ResetPasswordView(APIView):
    permission_classes = [AllowAny]

    @transaction.atomic
    def post(self, request):
        email = request.data.get('email')
        otp_code = request.data.get('otp')
        password = request.data.get('password')
        confirm_password = request.data.get('confirm_password')

        if not email or not otp_code or not password or not confirm_password:
            return Response(
                {'detail': 'Email, OTP, and both password fields are required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if password != confirm_password:
            return Response(
                {'detail': 'Passwords do not match.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user = User.objects.filter(email=email).first()
        if not user:
            return Response(
                {'detail': 'Invalid email or OTP.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        otp = get_active_otp(user, 'password_reset', otp_code)
        if not otp:
            return Response(
                {'detail': 'Invalid or expired OTP.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user.set_password(password)
        user.is_active = True
        user.save()
        otp.mark_used()
        return Response({'detail': 'Password reset successful. You can now log in.'})


class RoleRestrictedLoginView(TokenObtainPairView):
    serializer_class = RoleTokenObtainPairSerializer
    expected_role = None

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context['expected_role'] = self.expected_role
        return context


class UserLoginView(RoleRestrictedLoginView):
    expected_role = 'user'


class StaffLoginView(RoleRestrictedLoginView):
    expected_role = 'staff'


class AdminLoginView(RoleRestrictedLoginView):
    expected_role = 'admin'


class MeView(generics.RetrieveUpdateAPIView):
    serializer_class = UserProfileSerializer
    permission_classes = [IsAuthenticated]
    parser_classes = [JSONParser, FormParser, MultiPartParser]

    def get_object(self):
        return self.request.user


class ChangePasswordView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = ChangePasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user = request.user
        if not user.check_password(serializer.validated_data['current_password']):
            raise ValidationError({'current_password': 'Current password is incorrect.'})

        user.set_password(serializer.validated_data['new_password'])
        user.save(update_fields=['password'])

        return Response({'detail': 'Password updated successfully.'})


class UserDashboardView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        paid_tickets = Ticket.objects.filter(user=user, is_paid=True).select_related('event')

        tickets_count = paid_tickets.count()
        attended_events = paid_tickets.filter(is_used=True).count()

        upcoming_events_qs = Event.objects.filter(status='approved', date__gte=timezone.now()).order_by('date')[:6]
        upcoming_events = [
            {
                'id': event.id,
                'name': event.title,
                'date': event.date.strftime('%Y-%m-%d'),
                'time': event.date.strftime('%I:%M %p'),
                'location': event.location,
            }
            for event in upcoming_events_qs
        ]

        recent_bookings = []
        for ticket in paid_tickets.order_by('-created_at')[:6]:
            if ticket.is_used:
                booking_status = 'Used'
            elif ticket.event.date < timezone.now():
                booking_status = 'Expired'
            else:
                booking_status = 'Active'

            recent_bookings.append(
                {
                    'id': ticket.id,
                    'event': ticket.event.title,
                    'status': booking_status,
                    'date': ticket.created_at.strftime('%Y-%m-%d %I:%M %p'),
                    'tickets': 1,
                }
            )

        return Response(
            {
                'tickets_count': tickets_count,
                'attended_events': attended_events,
                'upcoming_events': upcoming_events,
                'recent_bookings': recent_bookings,
            }
        )


class UserManagementViewSet(viewsets.ModelViewSet):
    serializer_class = AdminUserManagementSerializer
    permission_classes = [IsAuthenticated, IsAdminRole]
    queryset = User.objects.all().order_by('-date_joined')

    def get_queryset(self):
        queryset = super().get_queryset()
        role = self.request.query_params.get('role')
        query = self.request.query_params.get('q')

        if role in ['admin', 'staff', 'user']:
            queryset = queryset.filter(role=role)

        if query:
            queryset = queryset.filter(
                Q(username__icontains=query)
                | Q(email__icontains=query)
                | Q(first_name__icontains=query)
                | Q(last_name__icontains=query)
            )

        return queryset

    def perform_destroy(self, instance):
        if instance.id == self.request.user.id:
            raise PermissionDenied('You cannot delete your own account.')

        if instance.role == 'admin':
            active_admins = User.objects.filter(role='admin', is_active=True).count()
            if active_admins <= 1:
                raise ValidationError('At least one active admin account must remain.')

        instance.delete()

    def perform_update(self, serializer):
        previous = self.get_object()
        was_staff = previous.role == 'staff' and previous.is_active
        user = serializer.save()

        if was_staff and (user.role != 'staff' or not user.is_active):
            now = timezone.now()
            StaffDutyAssignment.objects.filter(
                staff=user,
                ends_at__gt=now,
            ).update(ends_at=now)

            notify_user(
                user,
                'Staff permissions updated',
                'Your active and upcoming staff duties were ended because your staff status changed.',
                'warning',
            )


class UserDirectoryView(generics.ListAPIView):
    serializer_class = UserDirectorySerializer
    permission_classes = [IsAuthenticated, IsStaffOrAdminRole]

    def get_queryset(self):
        queryset = User.objects.filter(role='user', is_active=True).order_by('username')
        query = self.request.query_params.get('q')
        if query:
            queryset = queryset.filter(
                Q(username__icontains=query)
                | Q(email__icontains=query)
                | Q(first_name__icontains=query)
                | Q(last_name__icontains=query)
            )
        return queryset[:50]


class StaffDutyAssignmentViewSet(viewsets.ModelViewSet):
    serializer_class = StaffDutyAssignmentSerializer
    permission_classes = [IsAuthenticated, IsStaffOrAdminRole]
    queryset = StaffDutyAssignment.objects.select_related('staff', 'event', 'created_by')

    def get_queryset(self):
        queryset = super().get_queryset()

        if self.request.user.role == 'staff':
            queryset = queryset.filter(staff=self.request.user)

        staff_id = self.request.query_params.get('staff')
        if self.request.user.role == 'admin' and staff_id:
            queryset = queryset.filter(staff_id=staff_id)

        upcoming = self.request.query_params.get('upcoming')
        if upcoming in ['1', 'true', 'True']:
            queryset = queryset.filter(ends_at__gte=timezone.now())

        return queryset

    def create(self, request, *args, **kwargs):
        if request.user.role != 'admin':
            raise PermissionDenied('Only admins can assign staff duties.')
        return super().create(request, *args, **kwargs)

    def update(self, request, *args, **kwargs):
        if request.user.role != 'admin':
            raise PermissionDenied('Only admins can update staff duties.')
        return super().update(request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        if request.user.role != 'admin':
            raise PermissionDenied('Only admins can update staff duties.')
        return super().partial_update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        if request.user.role != 'admin':
            raise PermissionDenied('Only admins can delete staff duties.')
        return super().destroy(request, *args, **kwargs)

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


class MyNotificationsView(generics.ListAPIView):
    serializer_class = NotificationSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Notification.objects.filter(user=self.request.user).order_by('-created_at')


class MarkNotificationReadView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, pk):
        try:
            notification = Notification.objects.get(pk=pk, user=request.user)
            notification.is_read = True
            notification.save(update_fields=['is_read'])
            return Response({'status': 'success'})
        except Notification.DoesNotExist:
            return Response({'error': 'Not found'}, status=status.HTTP_404_NOT_FOUND)


SUPPORT_ACTIVE_STATUSES = ['new', 'assigned', 'waiting_user']
SUPPORT_OPEN_STATUSES_FOR_USER = ['new', 'assigned', 'waiting_user', 'resolved']


def notify_user(user, title, message, notification_type='info'):
    Notification.objects.create(
        user=user,
        title=title,
        message=message,
        type=notification_type,
    )


def classify_support_message(message):
    text = (message or '').lower()

    payment_keywords = ['payment', 'paid', 'pay', 'refund', 'billing', 'charge', 'card', 'transaction']
    account_keywords = ['account', 'password', 'login', 'email', 'security', 'blocked', 'suspended']
    policy_keywords = ['policy', 'ban', 'appeal', 'terms', 'abuse']
    complaint_keywords = ['complaint', 'report', 'fraud', 'scam']
    ticket_keywords = ['ticket', 'seat', 'event', 'match', 'gate', 'scanner', 'stadium']

    if any(keyword in text for keyword in payment_keywords):
        return 'payment', 'staff'
    if any(keyword in text for keyword in account_keywords):
        return 'account', 'admin'
    if any(keyword in text for keyword in policy_keywords):
        return 'policy', 'admin'
    if any(keyword in text for keyword in complaint_keywords):
        return 'complaint', 'admin'
    if any(keyword in text for keyword in ticket_keywords):
        return 'ticket', 'staff'

    return 'general', 'staff'


def determine_priority(message):
    text = (message or '').lower()
    urgent_keywords = ['urgent', 'asap', 'immediately', 'fraud', 'hacked', 'stolen']
    high_keywords = ['not working', 'failed', 'error', 'cannot', 'cant', 'problem']

    if any(keyword in text for keyword in urgent_keywords):
        return 'urgent'
    if any(keyword in text for keyword in high_keywords):
        return 'high'

    return 'normal'


def pick_available_agent(role):
    if role not in ['staff', 'admin']:
        return None

    return (
        User.objects.filter(role=role, is_active=True)
        .annotate(
            open_support_count=Count(
                'assigned_support_conversations',
                filter=Q(assigned_support_conversations__status__in=SUPPORT_ACTIVE_STATUSES),
            )
        )
        .order_by('open_support_count', 'id')
        .first()
    )


def ensure_agent_assignment(conversation):
    current_assignee = conversation.assigned_to

    if (
        current_assignee
        and current_assignee.is_active
        and current_assignee.role == conversation.assigned_role
    ):
        return current_assignee

    assignee = pick_available_agent(conversation.assigned_role)
    if not assignee and conversation.assigned_role == 'staff':
        conversation.assigned_role = 'admin'
        assignee = pick_available_agent('admin')

    conversation.assigned_to = assignee
    return assignee


def user_can_access_conversation(user, conversation):
    if user.role == 'admin':
        return True

    if user.role == 'staff':
        return conversation.assigned_role == 'staff' or conversation.assigned_to_id == user.id

    return conversation.user_id == user.id


def get_conversation_or_none(conversation_id):
    try:
        return (
            SupportConversation.objects.select_related('user', 'assigned_to')
            .prefetch_related('messages__sender')
            .get(id=conversation_id)
        )
    except SupportConversation.DoesNotExist:
        return None


def update_conversation_preview(conversation, message_text, message_time=None):
    preview = (message_text or '').strip().replace('\n', ' ')
    if len(preview) > 260:
        preview = f"{preview[:257]}..."

    conversation.last_message_preview = preview
    conversation.last_message_at = message_time or timezone.now()


def create_user_support_case(user, text, category=None, priority=None):
    conversation = (
        SupportConversation.objects.filter(user=user, status__in=SUPPORT_OPEN_STATUSES_FOR_USER)
        .order_by('-updated_at')
        .first()
    )

    if not conversation:
        classified_category, _ = classify_support_message(text)
        conversation = SupportConversation(
            user=user,
            assigned_role='staff',
            status='new',
            category=category or classified_category,
            priority=priority or determine_priority(text),
            subject=text[:120],
        )

    assignee = ensure_agent_assignment(conversation)
    if conversation.status in ['new', 'waiting_user', 'resolved', 'closed']:
        conversation.status = 'assigned'

    if conversation.pk is None:
        conversation.save()

    message = SupportMessage.objects.create(
        conversation=conversation,
        sender=user,
        sender_role='user',
        message=text,
    )
    update_conversation_preview(conversation, message.message, message.created_at)
    conversation.save()

    if assignee:
        notify_user(
            assignee,
            'New support message',
            f'{user.username}: {conversation.last_message_preview}',
            'info',
        )

    return get_conversation_or_none(conversation.id)


def format_event_for_chat(event):
    event_time = timezone.localtime(event.date).strftime('%b %d, %Y at %I:%M %p')
    return f'{event.title} - {event_time} - {event.location}'


def google_translate(text, target_lang, source_lang='auto'):
    import urllib.parse
    import urllib.request
    import json
    import ssl
    try:
        url = "https://translate.googleapis.com/translate_a/single?client=gtx&sl=" + source_lang + "&tl=" + target_lang + "&dt=t&q=" + urllib.parse.quote(text)
        req = urllib.request.Request(
            url, 
            headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}
        )
        context = ssl._create_unverified_context()
        with urllib.request.urlopen(req, context=context, timeout=5) as response:
            data = json.loads(response.read().decode('utf-8'))
            translated_text = "".join([chunk[0] for chunk in data[0] if chunk[0]])
            detected_lang = data[2] if len(data) > 2 else None
            return translated_text, detected_lang
    except Exception:
        return None, None


def call_gemini_ai(prompt_text, system_instruction=None):
    import os
    import json
    import urllib.request
    import ssl

    api_key = os.environ.get('GEMINI_API_KEY')
    if not api_key:
        return None

    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={api_key}"
    payload = {
        "contents": [
            {
                "parts": [
                    {"text": prompt_text}
                ]
            }
        ]
    }
    if system_instruction:
        payload["system_instruction"] = {
            "parts": [{"text": system_instruction}]
        }

    try:
        data_bytes = json.dumps(payload).encode('utf-8')
        req = urllib.request.Request(
            url,
            data=data_bytes,
            headers={'Content-Type': 'application/json'}
        )
        context = ssl._create_unverified_context()
        with urllib.request.urlopen(req, context=context, timeout=8) as response:
            res_data = json.loads(response.read().decode('utf-8'))
            candidates = res_data.get('candidates', [])
            if candidates:
                parts = candidates[0].get('content', {}).get('parts', [])
                if parts:
                    return parts[0].get('text', '').strip()
    except Exception:
        pass
    return None


def _chatbot_response_en(user, value, upcoming, context=None):
    if context is None:
        context = {}

    # 1. Greetings & Identity
    if any(phrase in value for phrase in ['who are you', 'what is your name', 'what can you do', 'who made you']):
        context['last_topic'] = 'general'
        return (
            "🤖 I am the Mogadishu Stadium Virtual Assistant! I am designed to assist you with live match schedules, "
            "ticket purchases, pricing details, stadium entry rules, and payment verifications. How can I help you today?"
        ), False, None

    if any(word in value for word in ['thanks', 'thank you', 'mahadsanid', 'waad ku mahadsantahay', 'appreciated']):
        context['last_topic'] = 'greeting'
        return "You're welcome! Let me know if you need anything else.", False, None

    if any(value == g for g in ['hi', 'hello', 'hey', 'asc', 'sc', 'haaye', 'waa yahay', 'haa', 'yes', 'no', 'maya']):
        context['last_topic'] = 'greeting'
        return "Hello! Let me know if you need any help with events, ticket prices, locations, or purchases.", False, None

    if any(word in value for word in ['hello', 'hi', 'hey', 'greetings', 'subax wanaagsan', 'galab wanaagsan', 'habeen wanaagsan', 'nabaadiino', 'asalaamu calaykum', 'asc', 'sc']):
        if not any(q in value for q in ['how', 'where', 'price', 'cost', 'buy', 'purchase', 'scan', 'refund', 'ticket', 'event', 'match', 'schedule', 'food', 'drink', 'bottle', 'park']):
            context['last_topic'] = 'greeting'
            return "Hello! How can I help you today?", False, None

    is_ack = value.startswith(('ok', 'okay', 'cool', 'perfect', 'great', 'awesome')) or any(word in value for word in ['haaye', 'waa yahay'])
    if is_ack and not any(q in value for q in ['how', 'where', 'can i', 'could i', 'should i', 'want to', 'please', 'show me', 'list', 'iibso', 'iibsado', 'goosan', 'goosto']):
        context['last_topic'] = 'greeting'
        return "Great! Let me know if you need any other help.", False, None

    # 2. Expired Tickets & Entry Checks
    if any(word in value for word in ['expired', 'expire', 'expiration', 'dhacay', 'dhacaya', 'mageli', 'ma galayaa', 'ma gali karaa']):
        context['last_topic'] = 'expired'
        if any(w in value for w in ['dhacay', 'dhacaya', 'mageli', 'ma galayaa', 'ma gali karaa']):
            return "Maya! Haddii uu koodka QR-ka ee tigidhku dhaco (expired), lagaama ogolaanayo albaabka garoonka. Tigidhada dhacay ma lagu gali karo ciyaar kasta.", False, None
        return "No! If a QR code ticket is expired, stadium entry is strictly blocked by gate scanners. Expired tickets cannot be used to enter any match.", False, None

    # 3. Stadium Rules, Food, Drinks, Gates, Parking
    if any(word in value for word in ['food', 'drink', 'bottle', 'water', 'eat', 'snack', 'bring', 'allowed', 'item', 'prohibited', 'bag']):
        context['last_topic'] = 'rules'
        return (
            "📌 **Stadium Rules & Entry Guidance:**\n"
            "- **Gates Open:** Gates open 2 hours before kickoff.\n"
            "- **Food & Drinks:** Food in paper bags is allowed. Plastic bottles, aluminum cans, and glass containers are strictly prohibited for safety.\n"
            "- **Bags:** Small personal bags are inspected at security gates."
        ), False, None

    if any(word in value for word in ['park', 'parking', 'car', 'vehicle', 'drive']):
        context['last_topic'] = 'parking'
        return (
            "🚗 **Parking Information:**\n"
            "Official match day parking is available near the South Gate on a first-come, first-served basis. "
            "We recommend arriving at least 1 hour before kickoff."
        ), False, None

    # 4. Main intent matching - Events
    is_event_query = any(phrase in value for phrase in ['which event', 'available event', 'upcoming event', 'available match', 'event list', 'list event', 'show event', 'what event', 'schedule of event']) or (
        any(word in value for word in ['event', 'match', 'game', 'schedule', 'fixture', 'play']) and
        not any(w in value for w in ['ticket', 'pass', 'qr', 'scan', 'price', 'cost', 'buy', 'refund', 'expired', 'expire'])
    )
    if is_event_query:
        context['last_topic'] = 'events'
        events = list(upcoming[:5])
        if not events:
            return 'No, there are no approved upcoming events available right now. Please check Events again later.', False, None
        event_lines = '\n'.join(f'- {format_event_for_chat(event)}' for event in events)
        return f'Yes! Here are the next available events:\n{event_lines}', False, None

    # 5. Main intent matching - Pricing
    is_vip_query = 'vip' in value or 'normal' in value
    if 'how much' in value or any(word in value for word in ['price', 'cost', 'fee', 'rate']) or (is_vip_query and context.get('last_topic') == 'pricing'):
        context['last_topic'] = 'pricing'
        return 'Ticket prices are $1.00 for a Normal seat and $3.00 for a VIP seat.', False, None

    # 6. Main intent matching - Buying / Purchasing
    if any(word in value for word in ['buy', 'purchase', 'order', 'how to get', 'iibso', 'iibsado', 'gooso', 'goosan']):
        context['last_topic'] = 'buying'
        return (
            'Yes! Open Events, choose an approved event, select Normal or VIP, then complete payment. '
            'After payment succeeds, your QR pass appears in Passes.'
        ), False, None

    # 7. Scanning / Reader
    if any(word in value for word in ['scan', 'reader', 'scanner']):
        context['last_topic'] = 'scanning'
        return (
            'No. Ticket scanning is for authorized staff only. As a customer, open Passes and show your QR code to staff at the gate.'
        ), False, None

    # 8. Location / Venue / Gate
    if 'where is' in value or any(word in value for word in ['stadium', 'gate', 'location', 'venue', 'address', 'direction']):
        context['last_topic'] = 'location'
        locations = list(upcoming.values_list('location', flat=True).distinct()[:5])
        if locations:
            return f'Upcoming events currently list these stadium locations: {", ".join(locations)}. Show your QR pass to gate staff for entry guidance.', False, None
        return 'The event location is shown on its Events listing and on your pass. Show your QR pass to gate staff for entry guidance.', False, None

    # 9. Payment Issues / Deducted Money
    latest_ticket = Ticket.objects.filter(user=user).select_related('event').order_by('-created_at').first()
    payment_issue = any(phrase in value for phrase in [
        'paid but', 'didn’t get', "didn't get", 'money was deducted', 'money deducted',
        'payment status', 'transaction', 'payment reference', 'deducted', 'charged'
    ])
    if payment_issue:
        context['last_topic'] = 'payment_issue'
        if latest_ticket and latest_ticket.is_paid and latest_ticket.payment_status == 'paid':
            return (
                f'Your latest payment for {latest_ticket.event.title} is confirmed as paid. '
                'Your QR ticket is available in Passes.'
            ), False, None

        status_text = latest_ticket.payment_status if latest_ticket else 'not found'
        answer = (
            f'I checked your latest ticket payment record. Its status is: {status_text}. '
            'Please reply in the support case with your payment/reference number so staff can compare it with the payment provider.'
        )
        return answer, True, 'payment'

    # 10. Refunds / Cancellations
    if any(word in value for word in ['refund', 'money back', 'cancel']):
        context['last_topic'] = 'refund'
        return (
            'Yes, under certain conditions. Refunds require review. Paid, unused tickets may be refundable; used tickets and manual tickets cannot be refunded. '
            'I created a staff support case so your request can be checked.'
        ), True, 'payment'

    # 11. General Ticket inquiries
    if any(word in value for word in ['ticket', 'qr', 'pass', 'barcode']):
        context['last_topic'] = 'ticket'
        return (
            'Paid QR tickets are shown in Passes. If your paid ticket is missing or the QR code does not work, '
            'I created a staff support case for investigation.'
        ), True, 'ticket'

    # Fallback
    context['last_topic'] = 'general'
    return (
        'I could not solve that confidently, so I created a staff support case. '
        'A staff member can reply here and escalate it to an admin when admin action is required.'
    ), True, 'general'


def _chatbot_response_so(user, value, upcoming, context=None):
    if context is None:
        context = {}

    # 1. Greetings & Identity
    if any(phrase in value for phrase in ['kuma tahay', 'yaad tahay', 'magacaa', 'maxaad samayn kartaa']):
        context['last_topic'] = 'general'
        return (
            "🤖 Waxaan ahay Kaaliyaha Garoonka Muqdisho! Waxaan ku caawin karaa jadwalada ciyaaraha, "
            "iibsashada tigidhadha, qiimaha, shuruudaha garoonka, iyo xaqiijinta lacag-bixinta. Sideen kuu caawin karaa maanta?"
        ), False, None

    if any(word in value for word in ['thanks', 'thank you', 'mahadsanid', 'waad ku mahadsantahay']):
        context['last_topic'] = 'greeting'
        return "Adaa mudan! Fadlan ii sheeg haddii aad u baahan tahay caawimaad kale.", False, None

    if any(value == g for g in ['hi', 'hello', 'hey', 'asc', 'sc', 'haaye', 'waa yahay', 'haa', 'yes', 'no', 'maya']):
        context['last_topic'] = 'greeting'
        return "Haye! Fadlan ii sheeg haddii aad u baahan tahay caawimaad ku saabsan dhacdooyinka, qiimaha, goobta, ama iibsashada tigidhada.", False, None

    if any(word in value for word in ['hello', 'hi', 'hey', 'greetings', 'subax wanaagsan', 'galab wanaagsan', 'habeen wanaagsan', 'nabaadiino', 'asalaamu calaykum', 'asc', 'sc']):
        if not any(q in value for q in ['how', 'where', 'price', 'cost', 'buy', 'purchase', 'scan', 'refund', 'ticket', 'event', 'match', 'schedule']):
            context['last_topic'] = 'greeting'
            return "Haye! Sideen kuu caawin karaa maanta?", False, None

    is_ack = value.startswith(('ok', 'okay', 'cool', 'perfect', 'great', 'awesome')) or any(word in value for word in ['haaye', 'waa yahay'])
    if is_ack and not any(q in value for q in ['how', 'where', 'can i', 'could i', 'should i', 'want to', 'please', 'show me', 'list', 'iibso', 'iibsado', 'goosan', 'goosto']):
        context['last_topic'] = 'greeting'
        return "Aad u wanaagsan! Fadlan ii sheeg haddii aad u baahan tahay caawimaad kale.", False, None

    # 2. Expired Tickets & Entry Checks
    if any(word in value for word in ['expired', 'expire', 'expiration', 'dhacay', 'dhacaya', 'mageli', 'ma galayaa', 'ma gali karaa']):
        context['last_topic'] = 'expired'
        return "Maya! Haddii uu koodka QR-ka ee tigidhku dhaco (expired), lagaama ogolaanayo albaabka garoonka. Tigidhada dhacay ma lagu gali karo ciyaar kasta.", False, None

    # 3. Main intent matching - Events
    is_event_query_so = any(phrase in value for phrase in ['ciyaaraha soo socda', 'dhacdooyinka', 'kulamo', 'jadwal', 'goormee', 'sheeg ciyaaraha']) or (
        any(word in value for word in ['dhacdo', 'ciyaar', 'kulan', 'jadwal', 'goormee', 'schedule']) and
        not any(w in value for w in ['tikidh', 'tigidh', 'ticket', 'pass', 'qr', 'skaan', 'scan', 'qiimo', 'lacag', 'iibso', 'celi', 'dhacay', 'mageli'])
    )
    if is_event_query_so:
        context['last_topic'] = 'events'
        events = list(upcoming[:5])
        if not events:
            return 'Maya, waqtigan xaadirka ah ma jiraan dhacdooyin soo socda oo la ansixiyay. Fadlan dib u eeg dhacdooyinka hadhow.', False, None
        event_lines = '\n'.join(f'- {format_event_for_chat(event)}' for event in events)
        return f'Haa! Halkan waxaa ku qoran dhacdooyinka xiga ee la heli karo:\n{event_lines}', False, None

    # 3. Pricing
    if any(word in value for word in ['qiimo', 'lacag', 'qiimaha', 'biil', 'cost']):
        context['last_topic'] = 'pricing'
        return 'Qiimaha tigidhadu waa $1.00 kursiga caadiga ah (Normal seat) iyo $3.00 kursiga VIP-da ah.', False, None

    # 4. Buying
    if any(word in value for word in ['iibso', 'iibsado', 'goosan', 'goosto', 'iibka', 'iibsan', 'buy', 'purchase']):
        context['last_topic'] = 'buying'
        return (
            'Haa! Fur Dhacdooyinka (Events), dooro dhacdo la ansixiyay, dooro Normal ama VIP, ka dibna dhammaystir bixinta lacagta. '
            'Ka dib marka lacag-bixintu guulaysato, tigidhkaaga QR wuxuu ka soo muuqan doonaa Passes.'
        ), False, None

    # 5. Scan
    if any(word in value for word in ['skaan', 'scan', 'iskaan']):
        context['last_topic'] = 'scanning'
        return (
            'Maya. Skaan-raynta tigidhadu waxay u xirantahay oo kaliya shaqaalaha la ogolaaday. '
            'Adiga oo ah macmiil, fur Passes oo tus code-kaaga QR shaqaalaha jooga albaabka.'
        ), False, None

    # 6. Stadium & Location
    if any(word in value for word in ['stadium', 'garoon', 'garoonka', 'meesha', 'irid', 'albaab', 'goobta', 'location']):
        context['last_topic'] = 'location'
        locations = list(upcoming.values_list('location', flat=True).distinct()[:5])
        if locations:
            return f'Dhacdooyinka soo socda waxay hadda muujinayaan goobahan garoonka: {", ".join(locations)}. Tus tigidhkaaga QR shaqaalaha jooga albaabka si laguu hanuuniyo.', False, None
        return 'Goobta dhacdadu waxay ku qorantahay liiska Events iyo tigidhkaaga. Tus tigidhkaaga QR shaqaalaha jooga albaabka si laguu hanuuniyo.', False, None

    # 7. Payment Issue
    latest_ticket = Ticket.objects.filter(user=user).select_related('event').order_by('-created_at').first()
    payment_issue = any(phrase in value for phrase in [
        'lacagta la iga jaray', 'lacag la jaray', 'ma helin', 'aan helin', 'payment issue'
    ])
    if payment_issue:
        context['last_topic'] = 'payment_issue'
        if latest_ticket and latest_ticket.is_paid and latest_ticket.payment_status == 'paid':
            return (
                f'Lacag-bixintaadii ugu dambeysay ee {latest_ticket.event.title} waa la xaqiijiyay in la bixiyay. '
                'Tigidhkaaga QR waxaa laga heli karaa Passes.'
            ), False, None

        status_text = latest_ticket.payment_status if latest_ticket else 'not found'
        answer = (
            f'Waxaan hubiyay warbixinta lacag-bixinta ee tigidhkaagii ugu dambeeyay. Heerkiisu waa: {status_text}. '
            'Fadlan ku soo jawaab kiiska taageerada (support case) adoo raacaya lambarka tixraaca lacag-bixinta (payment reference) si shaqaaluhu u barbar dhigaan shirkadda lacagta bixisay.'
        )
        return answer, True, 'payment'

    # 8. Refund
    if any(word in value for word in ['celi', 'celin', 'refund', 'cancel']):
        context['last_topic'] = 'refund'
        return (
            'Haa, iyadoo ku xiran xaaladaha. Lacag-celintu waxay u baahan tahay dib-u-eegis. Tigidhada la bixiyay ee aan la isticmaalin waa la celin karaa; '
            'tigidhada la isticmaalay iyo kuwa gacanta lagu bixiyay dib looma celin karo. Waxaan kuu abuuray kiis taageero shaqaale si codsigaaga loo hubiyo.'
        ), True, 'payment'

    # 9. Ticket
    if any(word in value for word in ['tikidh', 'tigidh', 'ticket', 'qr', 'pass', 'barcode']):
        context['last_topic'] = 'ticket'
        return (
            'Tigidhada QR ee la bixiyay waxaa lagu muujiyaa Passes. Haddii tigidhkaagii la bixiyay uu maqan yahay ama code-ka QR uusan shaqaynayn, '
            'waxaan abuuray kiis taageero shaqaale si loo baaro.'
        ), True, 'ticket'

    # Fallback
    context['last_topic'] = 'general'
    return (
        'Kuma xallin karo taas si kalsooni leh, sidaas darteed waxaan kuu abuuray kiis taageero shaqaale. '
        'Xubin shaqaale ah ayaa halkaan kuugu soo jawaabi doona wuxuuna u gudbin doonaa maamulaha (admin) marka loo baahdo tallaabo maamul.'
    ), True, 'general'


def chatbot_response_for(user, message, session=None):
    text = (message or '').strip()
    value = text.lower()
    upcoming = Event.objects.filter(status='approved', date__gte=timezone.now()).order_by('date')

    context = session.get('chatbot_context', {}) if session is not None else {}

    # Detect language using keywords as a fallback/initial flag
    somali_keywords = [
        'dhacdo', 'ciyaar', 'kulan', 'kulamo', 'jadwal', 'goormee', 'qiimo', 'lacag', 
        'tikidh', 'tigidh', 'qiimaha', 'iibso', 'iibsado', 'goosan', 'goosto', 'skaan', 
        'scan', 'iskaan', 'garoon', 'garoonka', 'meesha', 'irid', 'albaab', 'celi', 'celin'
    ]
    is_somali = any(word in value for word in somali_keywords)

    # Try translating user message to English
    translated_text, detected_lang = google_translate(text, 'en')
    if detected_lang:
        is_somali = (detected_lang.startswith('so') or (detected_lang != 'en' and is_somali))

    if is_somali:
        if translated_text:
            ans, needs_support, category = _chatbot_response_en(user, translated_text.lower(), upcoming, context)
            translated_ans, _ = google_translate(ans, 'so', 'en')
            if translated_ans:
                rule_ans = translated_ans
            else:
                rule_ans = ans
        else:
            rule_ans, needs_support, category = _chatbot_response_so(user, value, upcoming, context)
    else:
        rule_ans, needs_support, category = _chatbot_response_en(user, value, upcoming, context)

    if session is not None:
        session['chatbot_context'] = context

    # If this query creates a support case (e.g. payment issue, refund), return rule answer directly
    if needs_support:
        return rule_ans, needs_support, category

    # Otherwise, try calling Gemini AI for an intelligent generative response
    upcoming_titles = [f"{e.title} ({e.date.strftime('%b %d')})" for e in upcoming[:5]]
    events_str = ", ".join(upcoming_titles) if upcoming_titles else "No approved upcoming events."
    system_inst = (
        "You are the Mogadishu Stadium Support AI Assistant. "
        "Provide helpful, friendly, and structured responses. "
        "Respond in the exact same language as the user (Somali or English). "
        f"Live context: Upcoming events = [{events_str}]. "
        "Ticket prices = Normal Seat ($1.00), VIP Seat ($3.00). "
        "Stadium gates open 2 hours before match. Food in paper bags is allowed."
    )
    ai_ans = call_gemini_ai(text, system_instruction=system_inst)
    if ai_ans:
        return ai_ans, False, None

    return rule_ans, False, None


class SupportChatbotView(APIView):
    permission_classes = [IsAuthenticated]

    @transaction.atomic
    def post(self, request):
        if request.user.role != 'user':
            return Response({'detail': 'Only users can access the support chatbot.'}, status=status.HTTP_403_FORBIDDEN)

        text = (request.data.get('message') or '').strip()
        if not text:
            return Response({'detail': 'Message is required.'}, status=status.HTTP_400_BAD_REQUEST)

        answer, needs_support, category = chatbot_response_for(request.user, text, session=request.session)
        conversation = create_user_support_case(request.user, text, category=category) if needs_support else None

        return Response({
            'answer': answer,
            'needs_support': needs_support,
            'support_created': conversation is not None,
            'conversation': SupportConversationDetailSerializer(conversation).data if conversation else None,
        })


class MySupportConversationView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if request.user.role != 'user':
            return Response({'detail': 'Only users can access this endpoint.'}, status=status.HTTP_403_FORBIDDEN)

        queryset = (
            SupportConversation.objects.filter(user=request.user)
            .select_related('user', 'assigned_to')
            .prefetch_related('messages__sender')
            .order_by('-updated_at')
        )

        conversation = queryset.exclude(status='closed').first() or queryset.first()
        if not conversation:
            return Response({'conversation': None})

        serializer = SupportConversationDetailSerializer(conversation)
        return Response({'conversation': serializer.data})


class MySupportConversationMessageView(APIView):
    permission_classes = [IsAuthenticated]

    @transaction.atomic
    def post(self, request):
        if request.user.role != 'user':
            return Response({'detail': 'Only users can send from this endpoint.'}, status=status.HTTP_403_FORBIDDEN)

        text = (request.data.get('message') or '').strip()
        if not text:
            return Response({'detail': 'Message is required.'}, status=status.HTTP_400_BAD_REQUEST)

        refreshed = create_user_support_case(request.user, text)
        serializer = SupportConversationDetailSerializer(refreshed)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class SupportConversationListView(APIView):
    permission_classes = [IsAuthenticated, IsStaffOrAdminRole]

    def get(self, request):
        queryset = SupportConversation.objects.select_related('user', 'assigned_to').order_by('-last_message_at', '-updated_at')

        if request.user.role == 'staff':
            queryset = queryset.filter(Q(assigned_role='staff') | Q(assigned_to=request.user))
        else:
            scope = request.query_params.get('scope', 'admin')
            if scope != 'all':
                queryset = queryset.filter(Q(assigned_role='admin') | Q(assigned_to=request.user))

        status_filter = request.query_params.get('status')
        if status_filter:
            queryset = queryset.filter(status=status_filter)

        priority_filter = request.query_params.get('priority')
        if priority_filter:
            queryset = queryset.filter(priority=priority_filter)

        mine_only = request.query_params.get('mine')
        if mine_only in ['1', 'true', 'True']:
            queryset = queryset.filter(assigned_to=request.user)

        query = (request.query_params.get('q') or '').strip()
        if query:
            queryset = queryset.filter(
                Q(user__username__icontains=query)
                | Q(subject__icontains=query)
                | Q(last_message_preview__icontains=query)
            )

        serializer = SupportConversationListSerializer(queryset, many=True)
        return Response(serializer.data)


class SupportConversationDetailView(APIView):
    permission_classes = [IsAuthenticated, IsStaffOrAdminRole]

    def get(self, request, pk):
        conversation = get_conversation_or_none(pk)
        if not conversation:
            return Response({'detail': 'Conversation not found.'}, status=status.HTTP_404_NOT_FOUND)

        if not user_can_access_conversation(request.user, conversation):
            return Response({'detail': 'Not allowed to access this conversation.'}, status=status.HTTP_403_FORBIDDEN)

        serializer = SupportConversationDetailSerializer(conversation)
        return Response(serializer.data)


class SupportConversationMessageCreateView(APIView):
    permission_classes = [IsAuthenticated]

    @transaction.atomic
    def post(self, request, pk):
        conversation = get_conversation_or_none(pk)
        if not conversation:
            return Response({'detail': 'Conversation not found.'}, status=status.HTTP_404_NOT_FOUND)

        if not user_can_access_conversation(request.user, conversation):
            return Response({'detail': 'Not allowed to send to this conversation.'}, status=status.HTTP_403_FORBIDDEN)

        text = (request.data.get('message') or '').strip()
        if not text:
            return Response({'detail': 'Message is required.'}, status=status.HTTP_400_BAD_REQUEST)

        sender_role = request.user.role
        if sender_role == 'user' and conversation.user_id != request.user.id:
            return Response({'detail': 'Not allowed to send to this conversation.'}, status=status.HTTP_403_FORBIDDEN)

        if sender_role == 'staff' and conversation.assigned_role == 'admin' and conversation.assigned_to_id != request.user.id:
            return Response({'detail': 'This conversation is currently admin-owned.'}, status=status.HTTP_403_FORBIDDEN)

        if sender_role in ['staff', 'admin']:
            if sender_role == 'admin' and conversation.assigned_role != 'admin':
                conversation.assigned_role = 'admin'

            if sender_role == 'staff' and conversation.assigned_role != 'staff':
                return Response({'detail': 'Staff cannot take this admin conversation.'}, status=status.HTTP_403_FORBIDDEN)

            conversation.assigned_to = request.user
            conversation.status = 'waiting_user'
        else:
            ensure_agent_assignment(conversation)
            conversation.status = 'assigned'

        message = SupportMessage.objects.create(
            conversation=conversation,
            sender=request.user,
            sender_role=sender_role,
            message=text,
        )
        update_conversation_preview(conversation, message.message, message.created_at)
        conversation.save()

        if sender_role in ['staff', 'admin']:
            notify_user(
                conversation.user,
                'Support replied',
                f'{sender_role.title()} reply: {conversation.last_message_preview}',
                'info',
            )
        elif conversation.assigned_to:
            notify_user(
                conversation.assigned_to,
                'New support message',
                f'{conversation.user.username}: {conversation.last_message_preview}',
                'info',
            )

        refreshed = get_conversation_or_none(conversation.id)
        serializer = SupportConversationDetailSerializer(refreshed)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class SupportConversationAssignSelfView(APIView):
    permission_classes = [IsAuthenticated, IsStaffOrAdminRole]

    def patch(self, request, pk):
        conversation = get_conversation_or_none(pk)
        if not conversation:
            return Response({'detail': 'Conversation not found.'}, status=status.HTTP_404_NOT_FOUND)

        if request.user.role == 'staff' and conversation.assigned_role != 'staff':
            return Response({'detail': 'Staff can only assign staff conversations.'}, status=status.HTTP_403_FORBIDDEN)

        if request.user.role == 'admin' and conversation.assigned_role != 'admin':
            conversation.assigned_role = 'admin'

        conversation.assigned_to = request.user
        if conversation.status in ['new', 'resolved', 'closed']:
            conversation.status = 'assigned'
        conversation.save()

        serializer = SupportConversationDetailSerializer(get_conversation_or_none(conversation.id))
        return Response(serializer.data)


class SupportConversationEscalateView(APIView):
    permission_classes = [IsAuthenticated, IsStaffOrAdminRole]

    def patch(self, request, pk):
        conversation = get_conversation_or_none(pk)
        if not conversation:
            return Response({'detail': 'Conversation not found.'}, status=status.HTTP_404_NOT_FOUND)

        if request.user.role == 'staff' and not user_can_access_conversation(request.user, conversation):
            return Response({'detail': 'Not allowed to escalate this conversation.'}, status=status.HTTP_403_FORBIDDEN)

        conversation.assigned_role = 'admin'
        if request.user.role == 'admin':
            conversation.assigned_to = request.user
        else:
            conversation.assigned_to = pick_available_agent('admin')

        conversation.status = 'assigned'
        conversation.save()

        if conversation.assigned_to:
            notify_user(
                conversation.assigned_to,
                'Escalated support conversation',
                f'Conversation #{conversation.id} needs admin action.',
                'warning',
            )

        notify_user(
            conversation.user,
            'Your issue was escalated',
            'Your support request has been escalated to an admin for action.',
            'info',
        )

        serializer = SupportConversationDetailSerializer(get_conversation_or_none(conversation.id))
        return Response(serializer.data)


class SupportConversationStatusUpdateView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, pk):
        conversation = get_conversation_or_none(pk)
        if not conversation:
            return Response({'detail': 'Conversation not found.'}, status=status.HTTP_404_NOT_FOUND)

        if not user_can_access_conversation(request.user, conversation):
            return Response({'detail': 'Not allowed to update this conversation.'}, status=status.HTTP_403_FORBIDDEN)

        next_status = request.data.get('status')
        allowed_statuses = {choice[0] for choice in SupportConversation.STATUS_CHOICES}
        if next_status not in allowed_statuses:
            return Response({'detail': 'Invalid status.'}, status=status.HTTP_400_BAD_REQUEST)

        if request.user.role == 'user' and next_status != 'closed':
            return Response({'detail': 'Users can only close their own conversation.'}, status=status.HTTP_403_FORBIDDEN)

        if request.user.role == 'staff' and conversation.assigned_role == 'admin' and conversation.assigned_to_id != request.user.id:
            return Response({'detail': 'This conversation is currently admin-owned.'}, status=status.HTTP_403_FORBIDDEN)

        conversation.status = next_status
        if request.user.role in ['staff', 'admin'] and conversation.assigned_to_id is None:
            conversation.assigned_to = request.user
        conversation.save(update_fields=['status', 'assigned_to', 'updated_at'])

        if next_status == 'resolved':
            notify_user(
                conversation.user,
                'Support request resolved',
                f'Conversation #{conversation.id} has been marked resolved.',
                'success',
            )

        serializer = SupportConversationDetailSerializer(get_conversation_or_none(conversation.id))
        return Response(serializer.data)


class TeamChatMessageViewSet(viewsets.ModelViewSet):
    serializer_class = TeamChatMessageSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        if self.request.user.role not in ['staff', 'admin']:
            raise PermissionDenied('Taageerada wada sheekaysigan waxaa loo oggol yahay oo keliya maamulka iyo shaqaalaha.')

        queryset = TeamChatMessage.objects.select_related('sender', 'recipient').order_by('created_at')
        recipient_id = self.request.query_params.get('recipient')

        if recipient_id:
            return queryset.filter(
                Q(sender=self.request.user, recipient_id=recipient_id)
                | Q(sender_id=recipient_id, recipient=self.request.user)
            )

        return queryset.filter(recipient__isnull=True)

    def perform_create(self, serializer):
        if self.request.user.role not in ['staff', 'admin']:
            raise PermissionDenied('Kaliya xubnaha garoonka ayaa diri kara fariimaha.')

        recipient = serializer.validated_data.get('recipient')
        if recipient:
            if recipient.role not in ['staff', 'admin'] or not recipient.is_active:
                raise ValidationError({'recipient': 'Select an active team member.'})
            if recipient.id == self.request.user.id:
                raise ValidationError({'recipient': 'You cannot send a direct team message to yourself.'})

        serializer.save(sender=self.request.user)


class TeamMemberListView(generics.ListAPIView):
    serializer_class = UserProfileSerializer
    permission_classes = [IsAuthenticated, IsStaffOrAdminRole]

    def get_queryset(self):
        return User.objects.filter(role__in=['admin', 'staff'], is_active=True).order_by('role', 'username')


def _team_chat_key(recipient_id=None):
    return f'direct:{recipient_id}' if recipient_id else 'group'


class TeamChatUnreadCountsView(APIView):
    permission_classes = [IsAuthenticated, IsStaffOrAdminRole]

    def get(self, request):
        user = request.user
        states = {
            state.chat_key: state.last_read_at
            for state in TeamChatReadState.objects.filter(user=user)
        }

        group_last_read = states.get('group')
        group_messages = TeamChatMessage.objects.filter(recipient__isnull=True).exclude(sender=user)
        if group_last_read:
            group_messages = group_messages.filter(created_at__gt=group_last_read)

        direct_counts = {}
        members = User.objects.filter(role__in=['admin', 'staff'], is_active=True).exclude(id=user.id)
        for member in members:
            chat_key = _team_chat_key(member.id)
            last_read = states.get(chat_key)
            direct_messages = TeamChatMessage.objects.filter(sender=member, recipient=user)
            if last_read:
                direct_messages = direct_messages.filter(created_at__gt=last_read)
            direct_counts[str(member.id)] = direct_messages.count()

        return Response(
            {
                'group': group_messages.count(),
                'direct': direct_counts,
            }
        )


class TeamChatMarkReadView(APIView):
    permission_classes = [IsAuthenticated, IsStaffOrAdminRole]

    def post(self, request):
        recipient_id = request.data.get('recipient')
        if recipient_id:
            try:
                recipient = User.objects.get(id=recipient_id, role__in=['admin', 'staff'], is_active=True)
            except User.DoesNotExist:
                return Response({'detail': 'Team member not found.'}, status=status.HTTP_404_NOT_FOUND)
            if recipient.id == request.user.id:
                return Response({'detail': 'Cannot mark self chat.'}, status=status.HTTP_400_BAD_REQUEST)
            chat_key = _team_chat_key(recipient.id)
        else:
            chat_key = _team_chat_key()

        TeamChatReadState.objects.update_or_create(
            user=request.user,
            chat_key=chat_key,
            defaults={'last_read_at': timezone.now()},
        )
        return Response({'status': 'read', 'chat_key': chat_key})

