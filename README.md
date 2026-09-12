# AssetFlow

Phase 1 plus MVP+: asset register, assign / transfer / return, handover acceptance, QR scan, warranty list, maintenance work orders, local attachments, dashboard counts, and CSV export.

## Run locally

1. Start MySQL (XAMPP is fine). Default connection is `root` with an empty password and database `assetflowdb`.
2. In `server/`:

```bash
npm install
npm run dev
```

The API migrates the schema and seeds demo data on startup. It listens on `http://localhost:5001`.

3. In `client/`:

```bash
npm install
npm run dev
```

The web app is at `http://localhost:3000`.

## Demo users

| Email                          | Password      | Role                |
|--------------------------------|---------------|---------------------|
| site@assetflow.example         | siteadmin123  | Site Admin          |
| admin@bashundhara.example      | admin123      | Organization Admin  |
| manager@bashundhara.example    | manager123    | Asset Manager       |
| employee@bashundhara.example   | employee123   | Employee            |

Site admin signs in at `/admin/organizations` to license, activate, and enter tenants. Tenant users cannot sign in if their organization is inactive or past its access end date.

Log out and sign in again if you used the previous login shell; Phase 1 uses a JWT.

## Tests

From `server/`:

```bash
npm test
```

These checks cover tenant isolation, role permissions, organization settings, Assigned → Damaged without a prior return, handover acceptance, warranty listing, and maintenance work orders.

Log out and sign in again after this update so new permissions appear in the client.

## Environment

See `server/.env.example`. Client uses `client/.env` (`VITE_API_URL`).
