# Barytes Manufacturing Management System (MVP)

Full-stack starter: React + Vite + Tailwind CSS, Node.js + Express, MySQL 8.
Includes login, role-based API protection, employees, attendance, products, production,
stock movements, customers, orders, invoices, vehicles, lorry trips and dashboard totals.

## Requirements
- Node.js 20+
- MySQL 8+
- npm

## 1. Database
Run `database/schema.sql` in MySQL Workbench or:
```bash
mysql -u root -p < database/schema.sql
```
This creates `barytes_management`. Configure the database credentials in `backend/.env`.

## 2. Backend
```bash
cd backend
cp .env.example .env
npm install
npm run seed-admin
npm run dev
```
API listens on `http://localhost:4000`. The seed command creates an admin using `ADMIN_EMAIL`
and `ADMIN_PASSWORD` from `.env`. Change the password before real use.

## 3. Frontend
In another terminal:
```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```
Open the URL Vite prints (usually `http://localhost:5173`) and log in with the seeded admin.

## Demo flow
1. Add a product (e.g. Barytes Powder Grade 4.2).
2. Record a production log. Production creates finished stock through a stock movement.
3. Add employees and record attendance.
4. Add a customer and order, create invoice, then record lorry trip/dispatch.
5. Use Reports/Dashboard to review totals.

## Roles
- `admin`: all modules and user administration.
- `manager`: operational modules.
- `accounts`: customers, orders, invoices and payments.
- `production`: production and inventory.
- `dispatch`: vehicles and trips.
- `hr`: employees and attendance.

The API uses a JWT in an HttpOnly cookie. Do not store JWTs in localStorage.
This is an MVP starter, not yet a substitute for a security review or statutory accounting review.

## Important operational notes
- Weights are metric tonnes, stored to 3 decimal places.
- Inventory changes are recorded in `stock_movements`; don't edit stock totals manually.
- Dispatch records should be reconciled with weighbridge slips and delivery proof.
- Invoice tax settings and invoice layout must be reviewed by your accountant before live GST use.
- For production deployment: use HTTPS, strong unique secrets, managed/private MySQL, firewall rules,
  automated backups, restore tests, monitoring, and restrict user creation to admins.
- To access from outside the office, deploy frontend/backend behind HTTPS. Never port-forward MySQL
  to the public internet. For office-only access, bind deployment to the private network or use VPN.

## Dashboard and downloadable reports (extended)

The dashboard now supports an inclusive **From / To** date range for attendance, production, lorry trips, orders and invoice totals. Current stock and outstanding receivables are shown as current balances. The Reports page provides a preview plus CSV and PDF downloads for attendance, production, stock movements, dispatch/weighbridge, and invoices/receivables.

### Upgrade an existing database

The existing schema already contains the tables required by the reports; no table/data migration is needed. For better performance on an established database, run the optional date-index migration once:

```bash
mysql -u root -p barytes_management < database/migrations/001_reporting_indexes.sql
```

If MySQL says an index already exists, check `SHOW INDEX FROM <table>;` and skip the duplicate index statement. Do not repeatedly run this migration; it uses ordinary `ALTER TABLE ADD INDEX` statements.

### Install and run

1. In `backend`, copy `.env.example` to `.env` and configure MySQL credentials plus a long random `JWT_SECRET`.
2. Install backend dependencies, including PDF generation: `npm install`.
3. Run tests: `npm test`.
4. Start the API: `npm run dev`.
5. In a second terminal, enter `frontend`, run `npm install`, then `npm run dev`.
6. Sign in, open **Dashboard** to filter dates, or open **Reports** to preview and download CSV/PDF.

### Report API

All routes require the existing HttpOnly-cookie login session.

- `GET /api/dashboard?from=2026-10-01&to=2026-10-14`
- `GET /api/reports/attendance?from=2026-10-01&to=2026-10-14`
- `GET /api/reports/production.csv?from=2026-10-01&to=2026-10-14`
- `GET /api/reports/inventory.pdf?from=2026-10-01&to=2026-10-14`
- Report types: `attendance`, `production`, `inventory`, `dispatch`, `accounts`; formats are JSON preview, `.csv`, and `.pdf`.

Date ranges are inclusive and limited to 367 days. Reports have role restrictions: HR can access attendance; production can access production; production/dispatch can access inventory; dispatch/accounts can access dispatch; accounts can access accounts. Admins and managers can access all report types. CSV fields are quoted and spreadsheet formula injection is neutralized.

### Verification checklist

- Confirm each report preview returns records only inside the selected date range.
- Download CSV and open it in Excel/LibreOffice; verify headers, dates, decimals, and special characters.
- Download PDF and confirm its title, period, columns, and page breaks.
- Try a reversed date range and a range longer than 367 days; the API should return HTTP 400.
- Test access with each role and confirm disallowed reports return HTTP 403.
- Confirm logged-out downloads return HTTP 401.
- Compare production totals, trip net tonnes, invoice totals and payments against the underlying tables before using reports for accounting/tax decisions.

### Report definitions

- **Attendance:** employee/day records and status.
- **Production:** raw input, finished output and recorded wastage.
- **Inventory:** movement ledger entries (not historical closing stock snapshots).
- **Dispatch:** gross, tare, calculated net tonnes, vehicle, driver and weighbridge slip.
- **Accounts:** invoices dated in the selected period and payments received up to the end date for those invoices. Outstanding in the dashboard is a current balance across all invoices.

PDF/CSV reports are operational exports, not audited statutory accounts. Validate tax rules and accounting treatment with your accountant before filing.
