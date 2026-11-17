# ⚡ NexusStation

> **Modern, High-Security Operations Hub, Project Telemetry & Resource Management Platform**

NexusStation is an encrypted, modular platform for managing client accounts, tracking project milestones and real-time execution hours, orchestrating billing and settlement records, monitoring operational expenses with zero-knowledge encrypted receipts, and safeguarding confidential enterprise assets (contracts, NDAs, credentials) with automated compliance auditing.

---

## 🏗️ Architecture & Technology Stack

| Layer | Technology | Key Capabilities |
| :--- | :--- | :--- |
| **Frontend** | React 18 + TypeScript + Vite | Tailwind CSS, Dark/Light theme, Lucide Icons, Recharts |
| **Backend** | Node.js (Node 22/24) + Express | RESTful API (`/api/v1`), Zod validation, Rate limiting, Helmet |
| **Database** | PostgreSQL + Prisma ORM | Automated schema migrations, strict tenant indexing, soft-deletes |
| **Cryptography** | Native Node.js `crypto` + `otplib` | AES-256-GCM field encryption at rest, Bcrypt (12 rounds), TOTP 2FA |
| **Storage** | Encrypted Local/S3 Storage | AES-256-GCM binary file encryption outside web root |
| **Reporting & PDF**| PDFKit + CSV-Parse / Stringify | Server-side invoice generation, P&L reports, CSV bulk export/import |
| **Deployment** | Docker & Docker Compose | Multi-stage Dockerfiles, Nginx SPA reverse proxy, health checks |

### Core Assumptions
- **Strict Data Isolation**: Every database table is isolated by `userId` (or `teamId`). IDOR attacks are mitigated at the middleware and ORM level.
- **Encryption at Rest**: Sensitive fields (client tax IDs, business EIN/VAT, banking wire numbers, receipt files, and uploaded contracts) are encrypted using authenticated **AES-256-GCM** before hitting disk or database columns.
- **Portability**: Production uses PostgreSQL in Docker. Zero-downtime database push / seed migrations are integrated into the boot process.

---

## 📁 Repository Structure

```
freelancevault/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma          # PostgreSQL relational schema
│   │   └── seed.ts                # Demo account & sample records
│   ├── src/
│   │   ├── config/env.ts          # Validated environment configuration
│   │   ├── controllers/           # Auth, Client, Project, Invoice, Expense, Doc, Report, Settings
│   │   ├── middlewares/           # JWT Auth, Role check, Rate limits, Zod validator, Tenant scope
│   │   ├── routes/                # Modular API v1 routes & Swagger documentation
│   │   ├── utils/                 # AES-256-GCM crypto, PDF generator, Encrypted storage, Audit log
│   │   ├── app.ts                 # Express application configuration
│   │   └── index.ts               # HTTP bootstrap listener
│   ├── tests/
│   │   ├── crypto.test.ts         # AES-256-GCM & Bcrypt unit tests
│   │   └── isolation.test.ts      # Multi-tenant data isolation test suite
│   ├── Dockerfile
│   ├── package.json
│   └── tsconfig.json
├── frontend/
│   ├── src/
│   │   ├── api/client.ts          # Fetch wrapper, JWT rotation, blob download triggers
│   │   ├── context/               # AuthContext (2FA, sessions) & ThemeContext (Dark/Light)
│   │   ├── components/            # Sidebar, Topbar, QuickAddExpense (<10s), GlobalSearch
│   │   ├── pages/                 # Dashboard, Clients, Projects, Invoices, Expenses, Vault, Reports, Settings
│   │   ├── types/index.ts         # TypeScript data contracts
│   │   ├── App.tsx                # Client-side protected routing
│   │   └── main.tsx
│   ├── nginx.conf                 # Production reverse proxy & security headers
│   ├── Dockerfile
│   ├── package.json
│   └── vite.config.ts
├── scripts/
│   ├── backup.sh                  # Encrypted database backup utility (Linux/macOS)
│   ├── restore.sh                 # Database recovery script
│   └── backup.bat                 # Windows backup helper
├── docker-compose.yml             # Single-command stack (PostgreSQL + Backend + Frontend)
├── .env.example                   # Master configuration template
└── README.md
```

---

## 🗄️ Database Design

The schema enforces foreign key constraints, indexes on lookup paths, and `deletedAt` for 30-day soft deletes across all resources:

1. **`User`**: Account credentials, bcrypt hash, email verification, TOTP secret, `currentSessionVersion` (enabling "Log out from all devices").
2. **`Team` & `TeamMember`**: Multi-user team sharing with roles (`OWNER`, `EDITOR`, `VIEWER`).
3. **`Client`**: Company, contact info, encrypted `taxId`, status (`ACTIVE`/`INACTIVE`), tags, notes.
4. **`Project`**: Rates (`HOURLY`/`FIXED`), budgets, milestone dates, linked time entries, profitability calculation.
5. **`TimeEntry`**: Start/stop timers, duration in minutes, billable flags.
6. **`Invoice` & `InvoiceItem`**: Auto-numbered invoices (`INV-1001`), line items, taxes, discounts, recurring intervals (`MONTHLY`, `QUARTERLY`, `YEARLY`), status (`DRAFT`, `SENT`, `PAID`, `OVERDUE`).
7. **`Payment`**: Partial and full payments, dates, methods (`BANK_TRANSFER`, `STRIPE`, `PAYPAL`), transaction references.
8. **`Expense` & `ExpenseCategory`**: Deductions, vendors, categories, billable tags, encrypted receipt file references.
9. **`Document`**: Encrypted vault items (NDAs, contracts, IDs), expiration dates with automated reminders.
10. **`Reminder`**: Tax deadlines, contract renewals, overdue payment follow-ups.
11. **`Setting`**: Business branding, AES-256 encrypted banking coordinates, currency, numbering prefixes.
12. **`AuditLog`**: Immutable security audit trail recording who, what, when, IP address, and payload diffs.

---

## 🚀 Quick Start (One Command)

### Option A: Running with Docker Compose (Recommended)

1. Clone or navigate to the repository directory:
   ```bash
   cd freelancevault
   ```

2. Copy the sample environment file:
   ```bash
   cp .env.example .env
   ```

3. Launch the complete application stack (PostgreSQL, Backend, Frontend):
   ```bash
   docker-compose up -d --build
   ```

4. Populate demo records (optional):
   ```bash
   docker exec -it freelancevault_backend npm run prisma:seed
   ```

5. Open your browser:
   - **Frontend App**: [http://localhost:3000](http://localhost:3000)
   - **Backend API**: [http://localhost:5000](http://localhost:5000)
   - **Swagger API Docs**: [http://localhost:5000/api/v1/docs](http://localhost:5000/api/v1/docs)

**Default Demo Credentials:**
- **Email**: `freelancer@vault.dev`
- **Password**: `DemoPassword123!`

---

### Option B: Local Development Setup (Without Docker)

#### Prerequisites
- Node.js v20+ and npm installed
- Local PostgreSQL instance running (or configure connection string in `backend/.env`)

#### 1. Setup Backend
```bash
cd backend
npm install
cp .env.example .env
# Edit DATABASE_URL in .env if needed
npx prisma generate
npx prisma db push
npm run prisma:seed   # Seed demo user and records
npm run dev           # Starts backend on http://localhost:5000
```

#### 2. Setup Frontend
```bash
cd frontend
npm install
npm run dev           # Starts Vite dev server on http://localhost:3000
```

#### 3. Run Automated Tests
```bash
cd backend
npm test              # Executes Vitest suite (Crypto + Tenant Isolation)
```

---

## 🛡️ Security Implementation & Verification

| Requirement | Implementation Detail | Verified By |
| :--- | :--- | :--- |
| **Strict Data Isolation** | Every controller invokes `getTenantScope(req)`. All queries enforce `where: { id, userId, deletedAt: null }`. User A can never query or manipulate User B's clients or invoices. | `backend/tests/isolation.test.ts` |
| **Encryption at Rest** | AES-256-GCM with unique 96-bit random IVs and 128-bit authentication tags. Encrypts sensitive fields (Tax IDs, bank numbers) and uploaded files on disk. | `backend/tests/crypto.test.ts` |
| **Password Hashing** | Bcrypt with 12 salt rounds (or Argon2). Plaintext passwords are never logged or stored. | `backend/src/utils/crypto.ts` |
| **Two-Factor Authentication** | RFC 6238 TOTP with QR Code generator using standard authenticator apps (Google Authenticator, Authy, 1Password). | `backend/src/controllers/authController.ts` |
| **Session Control** | Short-lived JWT access tokens (15m) + secure refresh tokens. Session invalidation increments `currentSessionVersion`, logging out all devices instantly. | `backend/src/middlewares/auth.ts` |
| **Rate Limiting** | Strict rate limiting on authentication routes (10 attempts / 15 mins) and general API limiting via `express-rate-limit`. | `backend/src/middlewares/rateLimiter.ts` |
| **Secure File Uploads** | Files validated for MIME types, size-capped (15MB), stored outside web root with randomized names, and encrypted with AES-256-GCM. | `backend/src/utils/storage.ts` |
| **HTTP Security Headers** | Helmet configuration enforcing CSP, HSTS (`maxAge: 31536000`), X-Frame-Options (`DENY`), X-Content-Type-Options (`nosniff`). | `backend/src/middlewares/securityHeaders.ts` |
| **Audit Logging** | High-fidelity audit records stored in `AuditLog` table for all logins, exports, modifications, and deletions. | `backend/src/utils/audit.ts` |
| **Soft Delete Recovery** | 30-day recycle bin retention allows recovering accidentally deleted records before permanent purge. | `backend/src/controllers/settingController.ts` |

---

## 💾 Backup & Restore Procedures

### 1. Daily Encrypted Backup
Run the backup script manually or configure a daily cron job:
```bash
./scripts/backup.sh
```
This dumps the PostgreSQL database, compresses it with gzip, and encrypts it with AES-256 using OpenSSL with PBKDF2 key derivation (100,000 iterations).

### 2. Full Account Vault Export (.vault)
In the application UI under **Settings → Account Security & Backups**, click **"Export Encrypted Backup"**. The app exports an encrypted JSON snapshot of your entire account containing clients, invoices, expenses, categories, and documents.

### 3. Restoring from Backup
```bash
./scripts/restore.sh ./backups/freelancevault_db_20261117_120000.sql.gz.enc
```

---

## 🌐 Production VPS Deployment Guide

To deploy FreelanceVault on a VPS (Ubuntu / Debian / Alpine on DigitalOcean, Linode, AWS, or Hetzner):

1. **Install Docker and Docker Compose on the host**:
   ```bash
   curl -fsSL https://get.docker.com -o get-docker.sh && sh get-docker.sh
   sudo usermod -aG docker $USER
   ```

2. **Clone repo and set production secrets**:
   ```bash
   git clone <repo-url> /opt/freelancevault
   cd /opt/freelancevault
   cp .env.example .env
   # Generate a 32-byte hex encryption master key:
   # node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   nano .env
   ```

3. **Start the stack with Docker Compose**:
   ```bash
   docker-compose up -d --build
   ```

4. **Setup Nginx reverse proxy with SSL (Let's Encrypt Certbot)**:
   ```nginx
   server {
       server_name vault.yourdomain.com;

       location / {
           proxy_pass http://127.0.0.1:3000;
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto https;
       }
   }
   ```
   Run: `sudo certbot --nginx -d vault.yourdomain.com`

---

## ✅ Definition of Done Checklist

- [x] Application runnable via `docker-compose up` with PostgreSQL, backend, and frontend.
- [x] Account registration, login, email verification, password reset, and TOTP 2FA.
- [x] Full Client management with encrypted Tax ID and billing history.
- [x] Projects with active start/stop timers, manual logging, and per-project profitability.
- [x] Invoices with dynamic line items, taxes, discounts, PDF export, and partial payment recording.
- [x] Quick-Add expense modal (<10 seconds), receipt upload encrypted at rest, and CSV bulk import/export.
- [x] Encrypted Documents Vault with type filters, expiry dates, and authenticated decryption download.
- [x] Tax & Financial Reports (P&L, Estimated Tax, Client/Category distributions, PDF & CSV exports).
- [x] Soft deletes with 30-day Recycle Bin recovery and permanent purge.
- [x] Multi-tenant isolation verified with automated test suite (`npm test`).
- [x] Immutable security audit trail.
- [x] Interactive OpenAPI/Swagger documentation at `/api/v1/docs`.
- [x] Automated encrypted database backup & restore scripts.
