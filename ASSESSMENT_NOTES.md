# Assessment Notes — FundFlow Bank Reconciliation Portal

## Integrity Statement
"I confirm that all code in this submission was written by me without the use of AI assistants or generative tools."

---

## 1. Application Name & Overview
- **Application Name:** **FundFlow**
- **Purpose:** Bank reconciliation portal for Private Equity / Venture Capital General Partners (GPs) and Limited Partners (LPs). Matches incoming bank wires against outstanding Capital Call line items, enables review/approval workflows, updates LP funded balances atomically, and enforces strict multi-tenant isolation.

---

## 2. Tech Stack & Architecture
- **Backend:** Python 3.12, Django 5.1 / Django REST Framework (DRF), WhiteNoise, Gunicorn.
- **Frontend:** React 19 SPA (Vite), Vanilla CSS design system with curated dark mode, high-contrast badges, real-time feedback, and accessible semantic markup.
- **Database:** PostgreSQL (with SQLite fallback for rapid unit testing without external database dependencies).
- **Containerization:** Docker & Docker Compose (PostgreSQL 16, Django Backend, Nginx-proxied React Frontend).

---

## 3. Data Model Summary

### `Organization` (Tenant)
- `name`: String
- `slug`: String, unique (e.g., `northwind`, `acme`)
- *Every entity in the system is tied to an organization via foreign key or strict scoping.*

### `InvestorEntity`
- Legal entity through which an LP invests (e.g., "Patel Family Trust", "Acme Holdings").
- `name`: Cleaned string
- `aliases`: JSON list of known bank description variants/substrings.

### `CapitalCall`
- `call_date`: Date when issued
- `due_date`: Date when payment is due
- `total_amount`: Total capital called

### `LineItem`
- One LP's allocation for a specific capital call.
- `investor`: Foreign key to `InvestorEntity`
- `amount_called`: Decimal(14, 2)
- `amount_funded`: Decimal(14, 2), default 0.00
- `wire_reference`: String code (e.g., `CC-1003`)
- `status`: Computed (`unfunded`, `partially_funded`, `funded`, `overfunded`)

### `BankTransaction`
- One row imported from a bank statement CSV.
- `date`: Transaction date
- `description`: Raw text from bank wire
- `amount`: Decimal(14, 2)
- `file_hash`: SHA-256 hash to prevent duplicate statement imports
- `reconciliation_status`: `unmatched`, `suggested`, `reconciled`, `ignored`

### `MatchSuggestion`
- Suggested link between a `BankTransaction` and a `LineItem`.
- `rule`: `EXACT_MATCH`, `FUZZY_NAME`, `AMOUNT_ONLY`, or `MULTIPLE_CALLS`
- `confidence`: `HIGH`, `MEDIUM`, `LOW`
- `explanation`: Human-readable justification (e.g., "Exact amount match & reference CC-1003 identified")
- `status`: `pending`, `approved`, `rejected`

---

## 4. REST API Endpoints

All tenant endpoints require the `X-Organization` header containing the tenant slug (e.g. `northwind`).

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/organizations/` | List all available organizations (multi-tenant switcher) |
| `POST` | `/api/import/` | Upload bank statement CSV, validate, and auto-generate suggestions |
| `GET` | `/api/transactions/` | List bank transactions with match suggestions and status filters |
| `GET` | `/api/line-items/` | List capital call line items grouped by call, with funding progress |
| `POST` | `/api/matches/{id}/approve/` | Atomically approve match, increment funded balance, lock transaction |
| `POST` | `/api/matches/{id}/reject/` | Reject match suggestion, return transaction to unmatched |
| `POST` | `/api/transactions/{id}/ignore/` | Mark non-capital-call transaction as ignored |

---

## 5. Setup & Running Instructions

### Option A: Running with Docker (Recommended)

1. **Clone the repository:**
   ```bash
   git clone <repo-url>
   cd <repo-folder>
   ```

2. **Start all services (Database, Backend, Frontend reverse proxy):**
   ```bash
   docker compose up --build
   ```
   - Frontend UI: `http://localhost:3000`
   - Backend API: `http://localhost:8000/api/`
   - Database: PostgreSQL on port `5432`

   *Migrations and demo seed data are applied automatically during container startup.*

---

### Option B: Local Setup (Without Docker)

#### 1. Backend Setup:
```bash
cd backend
python -m venv venv
# Windows:
.\venv\Scripts\activate
# Linux/macOS:
# source venv/bin/activate

pip install -r requirements.txt
cp .env.example .env

# Run migrations (uses SQLite if USE_SQLITE=True in .env, or PostgreSQL)
python manage.py migrate

# Seed initial organizations, capital calls, and line items (Idempotent)
python manage.py seed_demo

# Run all 33 unit and integration tests
python manage.py test reconciliation

# Start backend server
python manage.py runserver 8000
```

#### 2. Frontend Setup:
```bash
cd ../frontend
npm install
npm run dev
```
Open `http://localhost:5173` in your browser.

---

## 6. Assumptions & Trade-Offs

1. **Multi-Tenancy Isolation:**
   - Multi-tenancy is enforced via a dedicated `OrganizationMiddleware` and custom model managers ensuring every query is strictly tenant-scoped by `X-Organization` header.
   - Cross-tenant access attempts immediately fail with 403 or 404 responses.

2. **Exact vs Fuzzy Matching:**
   - Bank descriptions are cleaned by stripping common wire noise (e.g., `WIRE TRANSFER`, `FED#`, dates, reference codes).
   - Wire references (e.g. `CC-1003`) are prioritized for highest confidence matching.
   - Partial name matching uses token containment and alias matching.

3. **Concurrency & Safe Approvals:**
   - Approvals execute inside `transaction.atomic()` with `select_for_update()` to prevent race conditions or double funding.
   - Approving an already reconciled transaction is rejected as an idempotent 400 error.

4. **Duplicate Statement Imports:**
   - Transactions are de-duplicated by hash of `(date, amount, description, organization)`. Re-uploading the same statement will not duplicate rows.

---

## 7. Next Steps & Enhancements
- Webhook / Plaid automated bank feed synchronization.
- Multi-currency conversion handling with daily ECB spot rates.
- Split-payment matching (one bank transaction covering multiple capital call line items).
- Audit trail logging table tracking who approved/rejected each match with timestamp.
