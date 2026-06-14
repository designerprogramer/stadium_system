from datetime import timedelta

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

from .models import Notification, OTP, RegistrationRequest, StaffDutyAssignment, SupportConversation, SupportMessage, User
from .serializers import (
    AdminUserManagementSerializer,
    ChangePasswordSerializer,
    NotificationSerializer,
    RegisterSerializer,
    RoleTokenObtainPairSerializer,
    StaffDutyAssignmentSerializer,
    SupportConversationDetailSerializer,
    SupportConversationListSerializer,
    UserDirectorySerializer,
    UserProfileSerializer,
)


class EmailDeliveryUnavailable(APIException):
    status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    default_detail = 'Account creation failed because the OTP email could not be sent. Please try again later.'
    default_code = 'email_delivery_unavailable'


def send_otp_email(email, code, subject):
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


def chatbot_response_for(user, message):
    text = (message or '').strip()
    value = text.lower()
    upcoming = Event.objects.filter(status='approved', date__gte=timezone.now()).order_by('date')

    if any(phrase in value for phrase in ['which events', 'available event', 'upcoming event', 'available match', 'schedule']):
        events = list(upcoming[:5])
        if not events:
            return 'There are no approved upcoming events available right now. Please check Events again later.', False, None
        event_lines = '\n'.join(f'- {format_event_for_chat(event)}' for event in events)
        return f'Here are the next available events:\n{event_lines}', False, None

    if any(phrase in value for phrase in ['how much', 'ticket price', 'price of ticket', 'ticket cost']):
        return 'Ticket prices are $1.00 for a Normal seat and $3.00 for a VIP seat.', False, None

    if any(phrase in value for phrase in ['how can i buy', 'how do i buy', 'buy ticket', 'purchase ticket']):
        return (
            'Open Events, choose an approved event, select Normal or VIP, then complete payment. '
            'After payment succeeds, your QR pass appears in Passes.'
        ), False, None

    if any(phrase in value for phrase in ['can i scan', 'scan ticket', 'scan my ticket']):
        return (
            'Ticket scanning is for authorized staff only. As a customer, open Passes and show your QR code to staff at the gate.'
        ), False, None

    if any(phrase in value for phrase in ['where is the stadium', 'stadium gate', 'which gate', 'gate location', 'where is the gate']):
        locations = list(upcoming.values_list('location', flat=True).distinct()[:5])
        if locations:
            return f'Upcoming events currently list these stadium locations: {", ".join(locations)}. Show your QR pass to gate staff for entry guidance.', False, None
        return 'The event location is shown on its Events listing and on your pass. Show your QR pass to gate staff for entry guidance.', False, None

    latest_ticket = Ticket.objects.filter(user=user).select_related('event').order_by('-created_at').first()
    payment_issue = any(phrase in value for phrase in [
        'paid but', 'didn’t get ticket', "didn't get ticket", 'money was deducted',
        'money deducted', 'payment status', 'transaction', 'payment reference',
    ])
    if payment_issue:
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

    if any(phrase in value for phrase in ['refund', 'money back', 'cancel ticket']):
        return (
            'Refunds require review. Paid, unused tickets may be refundable; used tickets and manual tickets cannot be refunded. '
            'I created a staff support case so your request can be checked.'
        ), True, 'payment'

    if any(keyword in value for keyword in ['ticket', 'qr', 'pass']):
        return (
            'Paid QR tickets are shown in Passes. If your paid ticket is missing or the QR code does not work, '
            'I created a staff support case for investigation.'
        ), True, 'ticket'

    return (
        'I could not solve that confidently, so I created a staff support case. '
        'A staff member can reply here and escalate it to an admin when admin action is required.'
    ), True, 'general'


class SupportChatbotView(APIView):
    permission_classes = [IsAuthenticated]

    @transaction.atomic
    def post(self, request):
        if request.user.role != 'user':
            return Response({'detail': 'Only users can access the support chatbot.'}, status=status.HTTP_403_FORBIDDEN)

        text = (request.data.get('message') or '').strip()
        if not text:
            return Response({'detail': 'Message is required.'}, status=status.HTTP_400_BAD_REQUEST)

        answer, needs_support, category = chatbot_response_for(request.user, text)
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
