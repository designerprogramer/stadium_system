from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers
from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from .models import Notification, RegistrationRequest, StaffDutyAssignment, SupportConversation, SupportMessage, User


class RegisterSerializer(serializers.Serializer):
    username = serializers.CharField(max_length=150)
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)

    def validate_username(self, value):
        if User.objects.filter(username=value).exists():
            raise serializers.ValidationError("Username already exists.")
        if RegistrationRequest.objects.filter(username=value, verified=False).exists():
            raise serializers.ValidationError(
                "Username is reserved. Please verify your pending registration or choose another username."
            )
        return value

    def validate_email(self, value):
        if User.objects.filter(email=value).exists():
            raise serializers.ValidationError("Email already exists.")
        return value

    def create(self, validated_data):
        return validated_data


class RoleTokenObtainPairSerializer(TokenObtainPairSerializer):
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token['role'] = user.role
        token['username'] = user.username
        return token

    def validate(self, attrs):
        data = super().validate(attrs)
        expected_role = self.context.get('expected_role')
        if expected_role and self.user.role != expected_role:
            raise AuthenticationFailed("This account is not allowed to log in here.")

        request = self.context.get('request')
        profile_picture = None
        if self.user.profile_picture:
            profile_picture = self.user.profile_picture.url
            if request:
                profile_picture = request.build_absolute_uri(profile_picture)

        data['user'] = {
            'id': self.user.id,
            'username': self.user.username,
            'email': self.user.email,
            'role': self.user.role,
            'first_name': self.user.first_name,
            'last_name': self.user.last_name,
            'profile_picture': profile_picture,
        }
        return data


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'role', 'first_name', 'last_name', 'profile_picture']


class UserProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'role', 'first_name', 'last_name', 'profile_picture']
        read_only_fields = ['id', 'role']


class ChangePasswordSerializer(serializers.Serializer):
    current_password = serializers.CharField(write_only=True)
    new_password = serializers.CharField(write_only=True)
    confirm_password = serializers.CharField(write_only=True)

    def validate(self, attrs):
        if attrs['new_password'] != attrs['confirm_password']:
            raise serializers.ValidationError({'confirm_password': 'Passwords do not match.'})

        validate_password(attrs['new_password'])
        return attrs


class AdminUserManagementSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=False, allow_blank=False)

    class Meta:
        model = User
        fields = [
            'id',
            'username',
            'email',
            'first_name',
            'last_name',
            'role',
            'is_active',
            'date_joined',
            'password',
        ]
        read_only_fields = ['id', 'date_joined']

    def validate(self, attrs):
        request = self.context.get('request')
        instance = getattr(self, 'instance', None)
        creating = instance is None

        if creating and not attrs.get('password'):
            raise serializers.ValidationError({'password': 'Password is required when creating a user.'})

        if 'password' in attrs and attrs['password']:
            validate_password(attrs['password'])

        if request and request.user and request.user.role != 'admin':
            raise serializers.ValidationError('Only admins can manage users.')

        return attrs

    def create(self, validated_data):
        password = validated_data.pop('password')
        user = User(**validated_data)
        user.set_password(password)
        user.save()
        return user

    def update(self, instance, validated_data):
        password = validated_data.pop('password', None)
        for key, value in validated_data.items():
            setattr(instance, key, value)
        if password:
            instance.set_password(password)
        instance.save()
        return instance


class UserDirectorySerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'email']


class StaffDutyAssignmentSerializer(serializers.ModelSerializer):
    staff_details = UserSerializer(source='staff', read_only=True)
    event_title = serializers.CharField(source='event.title', read_only=True)
    created_by_details = UserSerializer(source='created_by', read_only=True)

    class Meta:
        model = StaffDutyAssignment
        fields = [
            'id',
            'staff',
            'staff_details',
            'event',
            'event_title',
            'duty_type',
            'title',
            'starts_at',
            'ends_at',
            'location',
            'notes',
            'can_scan_tickets',
            'can_assign_manual_tickets',
            'can_manage_bookings',
            'can_manage_events',
            'created_by',
            'created_by_details',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'created_by', 'created_by_details', 'created_at', 'updated_at']

    def validate_staff(self, value):
        if value.role != 'staff' or not value.is_active:
            raise serializers.ValidationError('Select an active staff account.')
        return value

    def validate(self, attrs):
        starts_at = attrs.get('starts_at', getattr(self.instance, 'starts_at', None))
        ends_at = attrs.get('ends_at', getattr(self.instance, 'ends_at', None))
        staff = attrs.get('staff', getattr(self.instance, 'staff', None))

        if starts_at and ends_at and ends_at <= starts_at:
            raise serializers.ValidationError({'ends_at': 'End time must be after start time.'})

        if staff and starts_at and ends_at:
            conflicts = StaffDutyAssignment.objects.filter(
                staff=staff,
                starts_at__lt=ends_at,
                ends_at__gt=starts_at,
            )
            if self.instance:
                conflicts = conflicts.exclude(pk=self.instance.pk)
            if conflicts.exists():
                raise serializers.ValidationError('This staff member already has a duty in that time window.')

        return attrs


class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = ['id', 'title', 'message', 'type', 'is_read', 'created_at']
        read_only_fields = ['id', 'title', 'message', 'type', 'created_at']


class SupportUserMiniSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'role']


class SupportMessageSerializer(serializers.ModelSerializer):
    sender = SupportUserMiniSerializer(read_only=True)

    class Meta:
        model = SupportMessage
        fields = ['id', 'sender', 'sender_role', 'message', 'created_at']


class SupportConversationListSerializer(serializers.ModelSerializer):
    user = SupportUserMiniSerializer(read_only=True)
    assigned_to = SupportUserMiniSerializer(read_only=True)

    class Meta:
        model = SupportConversation
        fields = [
            'id',
            'user',
            'assigned_to',
            'assigned_role',
            'status',
            'category',
            'priority',
            'subject',
            'last_message_preview',
            'last_message_at',
            'created_at',
            'updated_at',
        ]


class SupportConversationDetailSerializer(SupportConversationListSerializer):
    messages = SupportMessageSerializer(many=True, read_only=True)

    class Meta(SupportConversationListSerializer.Meta):
        fields = SupportConversationListSerializer.Meta.fields + ['messages']
