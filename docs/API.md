# API reference

All `/api/*` endpoints except `/api/health` and `/api/auth/login` require the login cookie.

- `GET /api/health`
- `POST /api/auth/login` `{ "email": "...", "password": "..." }`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `POST /api/users` admin only `{ name, email, password, role }`
- `GET /api/dashboard`
- `GET, POST /api/employees`
- `GET, POST /api/attendance` (upserts one employee/date)
- `GET, POST /api/products`
- `GET, POST /api/production` (transactionally creates raw-out and finished-in stock movements)
- `GET, POST /api/stock`
- `GET, POST /api/customers`
- `GET, POST /api/orders`
- `GET, POST /api/invoices` (calculates subtotal + tax)
- `GET, POST /api/payments` (updates invoice payment status)
- `GET, POST /api/vehicles`
- `GET, POST /api/drivers`
- `GET, POST /api/trips` (net tonnes = gross - tare)

List endpoints accept `?limit=100`, capped at 500. Role authorization is enforced by the backend, not just the UI.
