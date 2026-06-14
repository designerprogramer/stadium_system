from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import Notification, OTP, RegistrationRequest, StaffDutyAssignment, SupportConversation, SupportMessage, User


@admin.register(User)
class CustomUserAdmin(UserAdmin):
    fieldsets = UserAdmin.fieldsets + (
        ('Role', {'fields': ('role',)}),
    )
    list_display = ('username', 'email', 'role', 'is_staff', 'is_superuser')


@admin.register(OTP)
class OTPAdmin(admin.ModelAdmin):
    list_display = ('user', 'purpose', 'code', 'used', 'expires_at')
    list_filter = ('purpose', 'used')
    search_fields = ('user__email', 'code')


@admin.register(RegistrationRequest)
class RegistrationRequestAdmin(admin.ModelAdmin):
    list_display = ('email', 'username', 'verified', 'otp_expires_at', 'created_at')
    search_fields = ('email', 'username')


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ('user', 'title', 'type', 'is_read', 'created_at')
    list_filter = ('type', 'is_read')
    search_fields = ('user__username', 'title', 'message')


@admin.register(SupportConversation)
class SupportConversationAdmin(admin.ModelAdmin):
    list_display = (
        'id',
        'user',
        'assigned_to',
        'assigned_role',
        'status',
        'category',
        'priority',
        'last_message_at',
    )
    list_filter = ('assigned_role', 'status', 'category', 'priority')
    search_fields = ('user__username', 'assigned_to__username', 'subject', 'last_message_preview')


@admin.register(SupportMessage)
class SupportMessageAdmin(admin.ModelAdmin):
    list_display = ('id', 'conversation', 'sender', 'sender_role', 'created_at')
    list_filter = ('sender_role',)
    search_fields = ('conversation__id', 'sender__username', 'message')


@admin.register(StaffDutyAssignment)
class StaffDutyAssignmentAdmin(admin.ModelAdmin):
    list_display = ('id', 'staff', 'title', 'duty_type', 'starts_at', 'ends_at')
    list_filter = ('duty_type', 'starts_at')
    search_fields = ('staff__username', 'title', 'location')
