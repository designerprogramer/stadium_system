from django.contrib import admin
from django.urls import path, include, re_path
from django.views.generic import TemplateView

urlpatterns = [
    path("admin/", admin.site.urls),

    # API
    path("api/", include("accounts.urls")),
    path("api/events/", include("events.urls")),
]

# React routes only (exclude api + static + media)
urlpatterns += [
    re_path(
        r'^(?!api/|static/|media/).*$',
        TemplateView.as_view(template_name="index.html")
    )
]
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)