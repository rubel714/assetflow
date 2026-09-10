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

| Username | Password    | Role                |
|----------|-------------|---------------------|
| admin    | admin123    | Organization Admin  |
| manager  | manager123  | Asset Manager       |
| employee | employee123 | Employee            |

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
