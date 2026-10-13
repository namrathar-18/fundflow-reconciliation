# FundFlow — Bank Reconciliation for Capital Calls

FundFlow is a modern fund administration portal built for General Partners (GPs) and Limited Partners (LPs). It automates the reconciliation of messy bank wire descriptions against capital call line items with multi-tenant isolation, atomic match approvals, and audit safety.

![FundFlow Banner](https://img.shields.io/badge/FundFlow-Reconciliation-3b82f6?style=for-the-badge)
![Django](https://img.shields.io/badge/Django-5.1-092E20?style=for-the-badge&logo=django)
![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?style=for-the-badge&logo=postgresql)
![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?style=for-the-badge&logo=docker)

---

## Features

- **Automated Bank Statement Processing:** Import CSV bank records with duplicate detection.
- **Intelligent Suggestion Engine:** Matches payments via exact reference (`CC-XXXX`), investor aliases, and amounts with confidence ratings (`HIGH`, `MEDIUM`, `LOW`).
- **Atomic One-Click Approvals:** Concurrency-safe balance updates that prevent double-crediting.
- **Tenant Isolation:** Enforced multi-tenant isolation via `X-Organization` header scoping.
- **Capital Call Tracking:** Visual real-time funding progress bars per LP line item.
- **Full Test Suite:** 33 unit and integration test cases covering reconciliation, tenant boundaries, race safety, and edge cases.

---

## Quickstart with Docker

Run the complete stack (PostgreSQL, Django Backend, React Frontend reverse-proxy) with a single command:

```bash
docker compose up --build
```

- **Frontend App:** [http://localhost:3000](http://localhost:3000)
- **Backend API:** [http://localhost:8000/api/](http://localhost:8000/api/)
- **API Documentation & Admin:** [http://localhost:8000/admin/](http://localhost:8000/admin/)

---

## Local Development (Without Docker)

### 1. Backend

```bash
cd backend
python -m venv venv
# Activate virtual environment:
# Windows: .\venv\Scripts\activate
# macOS/Linux: source venv/bin/activate

pip install -r requirements.txt
cp .env.example .env

# Run migrations
python manage.py migrate

# Seed sample data (idempotent)
python manage.py seed_demo

# Run tests
python manage.py test reconciliation

# Run development server
python manage.py runserver 8000
```

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

App runs at `http://localhost:5173`.

---

## Testing

```bash
cd backend
python manage.py test reconciliation --verbosity=2
```

All 33 test suites validate:
- Exact wire reference matching
- Fuzzy entity alias matching
- Amount-only matching with `needs_review`
- Unmatched non-capital-call transactions
- Duplicate CSV prevention
- Atomic approvals without double-crediting
- Multi-tenant data segregation

---

## Security & Secrets

Secrets are loaded from environment variables via `.env`. No secrets, keys, or sensitive database dumps are checked into git. See `.env.example` for required configuration variables.
