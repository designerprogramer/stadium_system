from django.contrib import admin
from django.urls import path, include, re_path
from django.views.generic import TemplateView

from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
    path("admin/", admin.site.urls),

    # API
    path("api/", include("accounts.urls")),
    path("api/events/", include("events.urls")),
]

# React SPA fallback (IMPORTANT: last)
urlpatterns += [
    re_path(r'^(?!api/).*$', TemplateView.as_view(template_name="index.html")),
]

# MEDIA files (ONLY)
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)