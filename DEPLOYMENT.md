# Deployment Checklist

## Render-Only Deployment

The repository includes `render.yaml`. In Render, choose **New > Blueprint** and
connect the GitHub repository. The blueprint creates:

- `stadium-api`: Django API
- `stadium-frontend`: React static site
- `stadium-db`: PostgreSQL database

Set these secret/environment values in the Render service:

- `CORS_ALLOWED_ORIGINS=https://YOUR_RENDER_FRONTEND.onrender.com`
- `CSRF_TRUSTED_ORIGINS=https://YOUR_RENDER_FRONTEND.onrender.com`
- `STRIPE_SECRET_KEY=sk_test_...`
- `STRIPE_PUBLISHABLE_KEY=pk_test_...`
- `STRIPE_WEBHOOK_SECRET=whsec_...`
- `EMAIL_HOST=smtp.gmail.com` (or your SMTP provider)
- `EMAIL_HOST_USER=your-email@example.com`
- `EMAIL_HOST_PASSWORD=your-email-app-password`
- `DEFAULT_FROM_EMAIL=your-email@example.com`

Render supplies `DATABASE_URL`, and the blueprint generates `DJANGO_SECRET_KEY`.
The frontend static service sets `VITE_API_BASE_URL` to the Render API URL.

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
6. Start the API with:
   `gunicorn config.wsgi:application --workers 1 --timeout 120 --access-logfile - --error-logfile -`

Configure the Stripe webhook endpoint:

`https://API_HOST/api/events/stripe-webhook/`

Subscribe it to `payment_intent.succeeded` and set its signing secret as
`STRIPE_WEBHOOK_SECRET`.

## Frontend

1. Deploy `stadium-frontend` on Render from the blueprint.
2. Set `VITE_STRIPE_PUBLISHABLE_KEY`.
3. Set `VITE_API_BASE_URL` to your Render API URL plus `/api`, for example `https://YOUR_RENDER_API.onrender.com/api`.
4. Run `npm ci` and `npm run build` in `frontend`.
5. Serve `frontend/dist` through HTTPS.
6. Configure the host to rewrite unknown frontend routes to `index.html`.

### Netlify Legacy

Netlify is no longer the recommended production target for this app. If you use
it temporarily, do not configure Netlify rewrites or Functions for the API.

Set these variables in Netlify under **Project configuration > Environment variables**:

- `VITE_API_BASE_URL=https://YOUR_RENDER_API.onrender.com/api`
- `VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...` (or the live publishable key)

Do not add `STRIPE_SECRET_KEY` to Netlify. It belongs only in the backend
hosting environment.

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
