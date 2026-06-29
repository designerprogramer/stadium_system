from django.urls import path
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView

from .views import (
    ChangePasswordView,
    MarkNotificationReadView,
    MyNotificationsView,
    MySupportConversationMessageView,
    MySupportConversationView,
    MeView,
    RegisterView,
    ResetPasswordView,
    StaffLoginView,
    StaffDutyAssignmentViewSet,
    TeamChatMessageViewSet,
    TeamChatMarkReadView,
    TeamMemberListView,
    TeamChatUnreadCountsView,
    SupportChatbotView,
    SupportConversationAssignSelfView,
    SupportConversationDetailView,
    SupportConversationEscalateView,
    SupportConversationListView,
    SupportConversationMessageCreateView,
    SupportConversationStatusUpdateView,
    UserDashboardView,
    UserDirectoryView,
    UserLoginView,
    UserManagementViewSet,
    VerifyPasswordOtpView,
    VerifyRegisterOtpView,
    ForgotPasswordView,
    AdminLoginView,
)

router = DefaultRouter()
router.register('admin/users', UserManagementViewSet, basename='admin-users')
router.register('staff-duties', StaffDutyAssignmentViewSet, basename='staff-duties')
router.register('team-chat', TeamChatMessageViewSet, basename='team-chat')

urlpatterns = [
    path('register/', RegisterView.as_view()),
    path('verify-register-otp/', VerifyRegisterOtpView.as_view()),
    path('forgot-password/', ForgotPasswordView.as_view()),
    path('verify-password-otp/', VerifyPasswordOtpView.as_view()),
    path('reset-password/', ResetPasswordView.as_view()),
    path('login/', UserLoginView.as_view()),
    path('login/user/', UserLoginView.as_view()),
    path('login/staff/', StaffLoginView.as_view()),
    path('login/admin/', AdminLoginView.as_view()),
    path('refresh/', TokenRefreshView.as_view()),
    path('dashboard/', UserDashboardView.as_view()),
    path('me/', MeView.as_view()),
    path('me/change-password/', ChangePasswordView.as_view()),
    path('user-directory/', UserDirectoryView.as_view()),
    path('team-members/', TeamMemberListView.as_view()),
    path('team-chat/unread-counts/', TeamChatUnreadCountsView.as_view()),
    path('team-chat/mark-read/', TeamChatMarkReadView.as_view()),
    path('notifications/', MyNotificationsView.as_view()),
    path('notifications/<int:pk>/mark-read/', MarkNotificationReadView.as_view()),
    path('support/my-conversation/', MySupportConversationView.as_view()),
    path('support/chatbot/', SupportChatbotView.as_view()),
    path('support/my-conversation/messages/', MySupportConversationMessageView.as_view()),
    path('support/conversations/', SupportConversationListView.as_view()),
    path('support/conversations/<int:pk>/', SupportConversationDetailView.as_view()),
    path('support/conversations/<int:pk>/messages/', SupportConversationMessageCreateView.as_view()),
    path('support/conversations/<int:pk>/assign-self/', SupportConversationAssignSelfView.as_view()),
    path('support/conversations/<int:pk>/escalate/', SupportConversationEscalateView.as_view()),
    path('support/conversations/<int:pk>/status/', SupportConversationStatusUpdateView.as_view()),
]

urlpatterns += router.urls
