# Deployment Checklist

## Backend

### Render

The repository includes `render.yaml`. In Render, choose **New > Blueprint**,
connect the GitHub repository, and let Render create the Django web service and
PostgreSQL database.

Set these secret/environment values in the Render service:

- `CORS_ALLOWED_ORIGINS=https://digital-stadium.netlify.app`
- `CSRF_TRUSTED_ORIGINS=https://digital-stadium.netlify.app`
- `STRIPE_SECRET_KEY=sk_test_...`
- `STRIPE_PUBLISHABLE_KEY=pk_test_...`
- `STRIPE_WEBHOOK_SECRET=whsec_...`
- `EMAIL_HOST=smtp.gmail.com` (or your SMTP provider)
- `EMAIL_HOST_USER=your-email@example.com`
- `EMAIL_HOST_PASSWORD=your-email-app-password`
- `DEFAULT_FROM_EMAIL=your-email@example.com`

Render supplies `DATABASE_URL`, and the blueprint generates
`DJANGO_SECRET_KEY`. Netlify proxies API requests through a serverless function,
so leave `VITE_API_BASE_URL` unset or set it to `/.netlify/functions/api`.

1. Install dependencies:
   `pip install -r backend/requirements.txt`
2. Copy `.env.example` to `backend/.env` and replace every placeholder.
3. Use PostgreSQL in production and configure `DB_*`.
4. Set:
   - `DJANGO_DEBUG=False`
   - `DJANGO_SECRET_KEY` to a long random secret
   - `DJANGO_ALLOWED_HOSTS` to the API hostname
   - `CORS_ALLOWED_ORIGINS` and `CSRF_TRUSTED_ORIGINS` to the frontend HTTPS origin
   - Stripe, email, and database credentials
5. Run:
   - `python manage.py migrate`
   - `python manage.py collectstatic --noinput`
   - `python manage.py check --deploy`
6. Start the API with a production server such as:
   `gunicorn config.wsgi:application`

Configure the Stripe webhook endpoint:

`https://API_HOST/api/events/stripe-webhook/`

Subscribe it to `payment_intent.succeeded` and set its signing secret as
`STRIPE_WEBHOOK_SECRET`.

## Frontend

1. Set `VITE_STRIPE_PUBLISHABLE_KEY`.
2. Leave `VITE_API_BASE_URL` unset on Netlify, or set it to `/.netlify/functions/api`.
3. Run `npm ci` and `npm run build` in `frontend`.
4. Serve `frontend/dist` through HTTPS.
5. Configure the host to rewrite unknown frontend routes to `index.html`.

### Netlify

The repository includes `netlify.toml`, so importing the repository into
Netlify uses `frontend` as the base directory, runs `npm run build`, and
publishes `frontend/dist`.

Set these variables in Netlify under **Project configuration > Environment variables**:

- `VITE_API_BASE_URL=/.netlify/functions/api` (optional; the frontend defaults to this in production)
- `VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...` (or the live publishable key)

Do not add `STRIPE_SECRET_KEY` to Netlify. It belongs only in the backend
hosting environment. Deploy the Django backend separately and set its
`CORS_ALLOWED_ORIGINS` and `CSRF_TRUSTED_ORIGINS` to the Netlify HTTPS URL.

HTTPS is required for live camera ticket scanning outside `localhost`.

## Final Verification

- `python manage.py test`
- `python manage.py makemigrations --check --dry-run`
- `python manage.py check --deploy`
- `npm run lint`
- `npm run build`
- `npm run test:e2e`

Before going live, test registration email delivery, a real Stripe test payment,
the Stripe webhook, QR scanning from the intended staff device, refunds, and
database backups.
