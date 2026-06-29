from rest_framework import serializers
from django.utils import timezone

from accounts.serializers import UserSerializer
from accounts.models import User

from .models import Event, ExternalStadiumBooking, ManualTicketRequest, Ticket


class EventSerializer(serializers.ModelSerializer):
    created_by_details = UserSerializer(source='created_by', read_only=True)
    has_purchased = serializers.SerializerMethodField()

    class Meta:
        model = Event
        fields = [
            'id',
            'title',
            'description',
            'date',
            'location',
            'image',
            'is_sport_event',
            'team1_name',
            'team2_name',
            'team1_logo',
            'team2_logo',
            'status',
            'created_by',
            'created_by_details',
            'has_purchased',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['created_by', 'created_by_details', 'created_at', 'updated_at']

    def get_has_purchased(self, obj):
        request = self.context.get('request')
        user = getattr(request, 'user', None)
        if not user or not user.is_authenticated or getattr(user, 'role', None) != 'user':
            return False
        return obj.tickets.filter(user=user, is_paid=True).exists()


class EventUpdateStatusSerializer(serializers.ModelSerializer):
    class Meta:
        model = Event
        fields = ['status']


class TicketSerializer(serializers.ModelSerializer):
    user_details = UserSerializer(source='user', read_only=True)
    event_details = EventSerializer(source='event', read_only=True)

    class Meta:
        model = Ticket
        fields = [
            'id',
            'user',
            'user_details',
            'event',
            'event_details',
            'seat_type',
            'section',
            'seat_number',
            'price',
            'qr_code_hash',
            'is_paid',
            'payment_status',
            'is_used',
            'used_at',
            'refunded_at',
            'created_at',
        ]
        read_only_fields = [
            'user',
            'user_details',
            'price',
            'qr_code_hash',
            'is_paid',
            'payment_status',
            'is_used',
            'used_at',
            'refunded_at',
            'created_at',
        ]


class ManualTicketRequestSerializer(serializers.ModelSerializer):
    requester_details = UserSerializer(source='requester', read_only=True)
    target_user_details = UserSerializer(source='target_user', read_only=True)
    event_details = EventSerializer(source='event', read_only=True)
    ticket_details = TicketSerializer(source='ticket', read_only=True)

    class Meta:
        model = ManualTicketRequest
        fields = [
            'id',
            'requester',
            'requester_details',
            'target_username',
            'target_full_name',
            'target_user',
            'target_user_details',
            'event',
            'event_details',
            'seat_type',
            'section',
            'seat_number',
            'reason',
            'status',
            'admin_note',
            'reviewed_by',
            'ticket',
            'ticket_details',
            'created_at',
            'updated_at',
            'reviewed_at',
        ]
        read_only_fields = [
            'id',
            'requester',
            'requester_details',
            'target_user',
            'status',
            'admin_note',
            'reviewed_by',
            'ticket',
            'ticket_details',
            'created_at',
            'updated_at',
            'reviewed_at',
        ]

    def validate_target_username(self, value):
        username = (value or '').strip()
        if not username:
            raise serializers.ValidationError('Username is required.')
        return username

    def validate_target_full_name(self, value):
        full_name = (value or '').strip()
        if not full_name:
            raise serializers.ValidationError('Full name is required.')
        return full_name

    def validate_event(self, value):
        if value.status != 'approved':
            raise serializers.ValidationError('Manual tickets can only be requested for approved events.')
        if value.date <= timezone.now():
            raise serializers.ValidationError('Manual tickets cannot be requested for expired events.')
        return value

    def validate(self, attrs):
        username = attrs.get('target_username', '').strip()
        target_user = User.objects.filter(
            username=username,
            role='user',
            is_active=True,
        ).first()
        if not target_user:
            raise serializers.ValidationError({'target_username': 'No active user found with this username.'})

        attrs['target_user'] = target_user
        attrs['target_username'] = username
        attrs['target_full_name'] = attrs.get('target_full_name', '').strip()

        event = attrs.get('event')
        if event and Ticket.objects.filter(user=target_user, event=event, is_paid=True).exists():
            raise serializers.ValidationError('This user already has a ticket for this event.')

        seat_type = attrs.get('seat_type')
        section = attrs.get('section')
        seat_number = attrs.get('seat_number')
        if section is None or seat_number is None:
            raise serializers.ValidationError('Section and seat number are required.')
        if section != 1:
            raise serializers.ValidationError({'section': f'{seat_type} has one section only.'})

        max_seat = 100 if seat_type == 'VIP' else 600
        if not (1 <= seat_number <= max_seat):
            raise serializers.ValidationError({'seat_number': f'{seat_type} seat number must be between 1 and {max_seat}.'})

        return attrs


class ManualTicketReviewSerializer(serializers.ModelSerializer):
    class Meta:
        model = ManualTicketRequest
        fields = ['status', 'admin_note']

    def validate_status(self, value):
        if value not in ['approved', 'rejected']:
            raise serializers.ValidationError('Status must be approved or rejected for review.')
        return value


class ExternalStadiumBookingSerializer(serializers.ModelSerializer):
    created_by_details = UserSerializer(source='created_by', read_only=True)

    class Meta:
        model = ExternalStadiumBooking
        fields = [
            'id',
            'organizer_name',
            'contact_phone',
            'team1_name',
            'team2_name',
            'scheduled_at',
            'amount_paid',
            'payment_reference',
            'notes',
            'created_by',
            'created_by_details',
            'created_at',
        ]
        read_only_fields = ['id', 'created_by', 'created_by_details', 'created_at']

    def validate_amount_paid(self, value):
        if value <= 0:
            raise serializers.ValidationError('Amount paid must be greater than zero.')
        return value

    def validate_scheduled_at(self, value):
        if value <= timezone.now():
            raise serializers.ValidationError('Booking date and time must be in the future.')
        return value

    def validate(self, attrs):
        team1 = attrs.get('team1_name', '').strip()
        team2 = attrs.get('team2_name', '').strip()
        if team1.casefold() == team2.casefold():
            raise serializers.ValidationError({'team2_name': 'The two names must be different.'})

        attrs['organizer_name'] = attrs.get('organizer_name', '').strip()
        attrs['contact_phone'] = attrs.get('contact_phone', '').strip()
        attrs['team1_name'] = team1
        attrs['team2_name'] = team2
        attrs['payment_reference'] = attrs.get('payment_reference', '').strip()
        return attrs
