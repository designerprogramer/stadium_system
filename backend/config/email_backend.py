import os
import ssl
import sys

from django.core.mail.backends.smtp import EmailBackend as DjangoSMTPEmailBackend
from django.utils.functional import cached_property


def _env_true(name: str, default: str = "False") -> bool:
    return os.environ.get(name, default).strip().lower() in {"1", "true", "yes", "on"}


def _should_relax_x509_strict() -> bool:
    value = os.environ.get("EMAIL_TLS_RELAX_X509_STRICT")
    if value is None or not value.strip():
        # Python 3.13+ enables stricter OpenSSL checks that can reject
        # otherwise common SMTP chains.
        return sys.version_info >= (3, 13)
    return _env_true("EMAIL_TLS_RELAX_X509_STRICT")


class EmailBackend(DjangoSMTPEmailBackend):
    """
    SMTP backend with optional Python 3.13 strict X509 relaxation.

    By default on Python 3.13+, disable VERIFY_X509_STRICT to match Python 3.12
    compatibility for SMTP providers with non-critical Basic Constraints in CA
    certificates. Set EMAIL_TLS_RELAX_X509_STRICT=False to enforce strict mode.
    """

    @cached_property
    def ssl_context(self):
        context = super().ssl_context
        if _should_relax_x509_strict() and hasattr(ssl, "VERIFY_X509_STRICT"):
            context.verify_flags &= ~ssl.VERIFY_X509_STRICT
        return context
