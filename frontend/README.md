# Stadium System Frontend

## Commands

```bash
npm run dev
npm run lint
npm run build
npm run test:e2e
```

The Playwright browser tests use an installed Google Chrome channel and cover:

- Public portal entry points
- Role-protected dashboard routing
- Active, used, expired, and revoked customer passes
- Staff ticket-scanner page access

The Vite application lazy-loads route pages so Stripe checkout, QR scanning, and admin dashboards are downloaded only when opened.
