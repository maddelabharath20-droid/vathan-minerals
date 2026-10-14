# Dashboard and Reports: Implementation Guide

## What was added

1. Date-filtered dashboard endpoint and UI (`GET /api/dashboard?from=YYYY-MM-DD&to=YYYY-MM-DD`).
2. Report preview API (`GET /api/reports/:type?from=...&to=...`).
3. CSV export (`GET /api/reports/:type.csv?...`) with UTF-8 BOM, quoting/escaping, and spreadsheet formula-injection mitigation.
4. PDF export (`GET /api/reports/:type.pdf?...`) using PDFKit with report name, date range, columns and row data.
5. Role-based report access, date-range validation, optional performance indexes, and unit/API tests.

## Files to know

- `backend/src/server.js`: dashboard SQL, report SQL, auth/role enforcement, CSV and PDF routes.
- `backend/src/reportUtils.js`: shared date validation and CSV helpers.
- `backend/test/report-utils.test.js`: date and CSV tests.
- `backend/test/health.test.js`: basic health, tonnage and unauthenticated-route tests.
- `frontend/src/App.jsx`: dashboard date filter and Reports preview/download interface.
- `database/migrations/001_reporting_indexes.sql`: optional query performance indexes.

## Extend the reports

Add a report name to `REPORT_TYPES` in `reportUtils.js`, add its fixed SQL statement and parameter list in `fetchReportRows()` in `server.js`, then grant roles in `reportRoles`. Never interpolate a user-supplied table name or SQL fragment. If adding a column, verify the PDF remains readable and add tests for its formatting.
