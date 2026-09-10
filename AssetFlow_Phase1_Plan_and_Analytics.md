# AssetFlow — Project Plan and Analytics

**Product:** AssetFlow  
**Category:** Asset Lifecycle Management SaaS  
**Tagline:** Manage Every Asset. Every Stage.  
**Document date:** 10 September 2026  
**Source contract:** `AssetFlow_Claude_Code_Specification.txt`  
**Repo stack:** React + Vite + Tailwind (JavaScript) · Node.js + Express · MySQL · JWT

This file is a working plan plus an analysis of the codebase as of this date. The specification remains the build contract. Phase 1 is the only product scope that should be treated as “in flight” until it is accepted as done.

---

## 1. Product plan

### Vision

Multi-tenant B2B SaaS for the full asset lifecycle:

Request → Approval → Purchase → Receive → Tag → Assign → Transfer → Maintain → Return → Retire → Dispose

**Target customers:** SMEs, large companies, NGOs, factories, construction, project/site-based organizations.

### Phased roadmap

| Phase | Intent | When |
| --- | --- | --- |
| **Phase 1** | Register, RBAC, custody (assign / transfer / return), KPI counts, CSV, audit | Current |
| **MVP+** | QR/barcode, warranties, maintenance, employee my-assets + handover, local attachments | After Phase 1 is accepted |
| **Phase 2** | Requests/approvals, procurement, depreciation, disposal, email, construction extras, Excel/PDF | After MVP+ |
| **Phase 3** | AI assistant, predictive maintenance, advanced analytics, PWA, integrations | After core workflows are stable |

### Phase 1 build list (contract)

1. Organization and users  
2. Roles and permissions (3 roles + API middleware)  
3. Departments, locations, projects  
4. Asset categories  
5. Asset register (CRUD, search, filter, pagination)  
6. Assign, transfer, return  
7. Lifecycle events + audit log  
8. Dashboard KPI counts  
9. Asset register CSV export  

**First vertical slice:** Login → org structure → create asset → assign → dashboard counts update, with tenant isolation and permission checks.

**Out of Phase 1:** QR, maintenance workflows, warranty alerts, employee portal extras, approvals, depreciation, disposal, Excel/PDF, custom fields, email/SMS, AI, Docker/Redis unless required locally.

### Phase 1 roles and permissions

| Role | Grants |
| --- | --- |
| `organization_admin` | All Phase 1 permissions |
| `asset_manager` | `users.read`, `setup.manage`, `assets.read`, `assets.manage`, `assets.assign`, `reports.export`, `dashboard.read` |
| `employee` | `assets.read` (assigned only), `dashboard.read` (own counts) |

Employees cannot create users, change setup, create/edit assets, or assign/transfer/return.

### Status transitions (Phase 1)

**Allowed**

- Available → Assigned (assign)  
- Assigned → Available (return)  
- Assigned → Assigned (transfer)  
- Available or Assigned → Damaged or Lost  
- Any non-terminal → Retired (organization admin only)

**Forbidden:** assign, transfer, or return a Damaged, Lost, or Retired asset. In Repair / Disposed are not used in Phase 1.

### Tenancy rules

- Shared MySQL database; every tenant-owned row has `OrganizationId`.  
- Organization id comes from the authenticated user, never from the client.  
- `AssetTag` unique on `(OrganizationId, AssetTag)` (`AF-0001` sequential per org).  
- Username unique globally in Phase 1.

---

## 2. Analytics (codebase vs contract)

### Snapshot

| Area | Status |
| --- | --- |
| First slice (login, org structure, asset, assign/transfer/return, dashboard, JWT) | **Met** |
| Phase 1 numbered build items 1–9 | **Met** |
| Spec step 7: tenant isolation + permission checks | **Met** (automated tests in `server/test/phase1.test.js`) |
| Spec step 8: README + `.env.example` | **Met** |
| Release bar (loading/empty/error, audit, isolation, local run) | **Largely met** |
| MVP+ / Phase 2 / Phase 3 | **Not started as modules** (some extra fields exist; see below) |

**Judgement:** Phase 1 product scope is implemented in this repo. Remaining work is polish, operational hygiene, and staying out of later phases until Phase 1 is formally accepted.

### What was already in the repo before the Phase 1 close-out

- JWT login, RBAC middleware, org-scoped queries  
- Users, departments, locations, projects, categories  
- Asset CRUD, assign / transfer / return in transactions  
- Lifecycle events and asset/user audit writes  
- Dashboard assigned/available/total counts  
- CSV export  
- Seeded demo users: `admin` / `admin123`, `manager` / `manager123`, `employee` / `employee123`

### Gaps identified, then closed in this engagement

| Gap | Resolution |
| --- | --- |
| No automated isolation/RBAC tests | `server/test/phase1.test.js` (`npm test` in `server/`) |
| `org.manage` existed with no settings UI | GET/PATCH `/organization` + Organization → Settings |
| Assigned → Damaged/Lost required a return first | Status rules now match the spec; open assignment is closed |
| Managers could pick Retired in the form | Retire is admin-only in API and form |
| Dashboard missing Damaged / Lost / Retired | KPI cards added (employees still see assigned-to-me) |
| Register used client-only paging (API `pageSize=1000`) | Server search, status/category filters, pagination; CSV uses the same filters |
| Setup CRUD not audited; no audit screen | Setup audit writes + `/audit-logs` + Audit UI |
| Inconsistent loading/error states | Applied on dashboard, assets, users, setup lists |
| Audit UI 404 | API process had not been restarted; `/audit-logs` now live |
| User photos | Create/update user image, grid, header avatar |

### Extra vs Phase 1 table list (already built; not blockers)

These are **ahead of the Phase 1 schema list**. They are useful but should not expand further until Phase 1 is signed off:

- Suppliers and manufacturers (contact directory)  
- Countries and maintenance-schedule lookups  
- Asset warranty / receive dates and remarks  
- Asset images  
- User profile images  

**Do not treat as Phase 1 remaining work:** QR, maintenance work orders, warranty expiry alerts, employee handover acceptance, S3, email/SMS, AI.

### Architecture notes

- **Layout:** `client/` (UI, APIs only) and `server/` (Express, business rules).  
- **Auth:** Bearer JWT; permissions loaded from `role_permissions`.  
- **Custody:** `asset_assignments` (open/closed rows); not separate transfer/return tables.  
- **Timeline vs security log:** `asset_lifecycle_events` (user-facing) vs `audit_logs` (immutable field-level).  
- **Uploads:** `server/uploads/assets/` and `server/uploads/users/`, served at `/uploads`.  
- **Local URLs:** API `http://localhost:5001`, web `http://localhost:3000`.

### Risks and ops

1. **API must be restarted** after route/schema changes. A stale `node server.js` caused audit logs to 404 even though the code was correct.  
2. **`JWT_SECRET` unset** in local dev (warning on boot). Fine for local; required for any shared environment.  
3. **`hasPermission` client fallback** grants all keys to `organization_admin` even if the token omits the array. Server middleware is still the source of truth.  
4. **Isolation test org** `Phase1 Isolation Org` / `isolation_admin` is created by tests and left in the database.  
5. **No UI browser E2E** in CI; verification is API tests plus local click-through.  
6. Extra register fields (warranty, maintenance schedule) can confuse a Phase 1 demo narrative if not explained.

### Test coverage (current)

From `server/`:

```bash
npm test
```

Checks include:

- Employee cannot manage users, setup, assets, or assign; cannot export or read org settings/audit  
- Employee asset list is assigned-only  
- Manager cannot patch organization or retire  
- Demo admin cannot read another org’s asset by id  
- Assigned → Damaged without a prior return  
- Admin can GET/PATCH organization settings  

Last run in this engagement: **6 passed**.

---

## 3. Recommended next work (after Phase 1 acceptance)

Stay on the spec order. Do not start Phase 2 or AI first.

**MVP+ (section 6 of the spec)**

1. QR generate/print and scan page  
2. Warranties and in-app expiry list (fields already exist on assets)  
3. Maintenance requests and work orders  
4. Employee my-assets and handover acceptance  
5. Broader local file attachments (beyond images)

**Then Phase 2:** request/approval, procurement, capitalization/depreciation, disposal, email, construction extras, Excel/PDF reports.

---

## 4. Definition of done (checklist)

### First slice

- [x] Login works with JWT  
- [x] Organization structure can be created  
- [x] An asset can be created, assigned, transferred, and returned  
- [x] Dashboard counts reflect real data  
- [x] Queries are scoped by organization  
- [x] Role permissions are enforced  

### Release bar

- [x] Schema, API, authorization, frontend, validation  
- [x] Loading / empty / error states (main flows)  
- [x] Audit for custody and asset edits (plus setup CRUD + audit page)  
- [x] Tenant-isolation checks (automated)  
- [x] App runs locally with documented env vars (`README.md`, `server/.env.example`)  

---

## 5. How to run

1. Start MySQL (XAMPP is fine). Default: `root`, empty password, database `assetflowdb`.  
2. `server/`: `npm install` then `npm run dev` (migrates + seeds; port **5001**).  
3. `client/`: `npm install` then `npm run dev` (port **3000**).  
4. Demo: `admin` / `admin123`, `manager` / `manager123`, `employee` / `employee123`.

Restart the API after pulling schema or route changes.
