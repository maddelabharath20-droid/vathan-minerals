# VATHAN MINERALS — Cloud Deployment Guide

This guide explains how to deploy the **VATHAN MINERALS Platform** (Face & Fingerprint Biometric Attendance, Mining Operations, Inventory, Dispatches & Invoicing) to the cloud with automated database provisioning, SSL/HTTPS, and production builds.

---

## 🚀 Option 1: Render.com (Recommended Free Cloud Hosting)

Render supports automated full-stack deployments using the included [`render.yaml`](file:///c:/vm%20web/render.yaml) Blueprint. It automatically builds the React frontend, launches the Express API, and sets up a managed cloud MySQL database.

### Step 1: Push Code to GitHub
1. Create a new repository on [GitHub](https://github.com/new) named `vathan-minerals`.
2. Push your project from your terminal:
   ```bash
   git remote add origin https://github.com/YOUR_GITHUB_USERNAME/vathan-minerals.git
   git branch -M main
   git push -u origin main
   ```

### Step 2: Deploy on Render
1. Go to [dashboard.render.com](https://dashboard.render.com/) and sign in with GitHub.
2. Click **New +** → **Blueprint**.
3. Select your `vathan-minerals` repository.
4. Render will detect [`render.yaml`](file:///c:/vm%20web/render.yaml) and automatically create:
   * **Web Service:** `vathan-minerals-platform`
   * **Database:** `vathan-minerals-db` (MySQL)
5. Click **Apply**. Render will install dependencies, build the frontend, and launch the service with a secure HTTPS URL (e.g., `https://vathan-minerals.onrender.com`).

### Step 3: Initialize Database Tables
Once your Render database is created:
1. Copy the **External Connection String** from your Render MySQL database dashboard.
2. Run the schema migration to create all tables:
   ```bash
   mysql "<YOUR_RENDER_EXTERNAL_MYSQL_URL>" < database/schema.sql
   ```
3. Run the admin seed script (or use the web Sign-Up interface to create your administrator):
   ```bash
   node backend/src/seedAdmin.js
   ```

---

## 🚂 Option 2: Railway.app

1. Go to [railway.app](https://railway.app/) and sign in.
2. Click **New Project** → **Deploy from GitHub repo** → select `vathan-minerals`.
3. Click **+ Add Service** → **Database** → **MySQL**.
4. In your Web Service settings on Railway:
   * **Build Command:** `npm run postinstall && npm run build`
   * **Start Command:** `node backend/src/server.js`
   * Set Environment Variables (copy from `backend/.env.example` or reference the Railway MySQL service).
5. Generate a public domain under **Settings → Domains**.

---

## 🐳 Option 3: Docker / VPS Cloud (AWS, DigitalOcean, Hetzner, Linode)

If deploying to your own cloud Linux server (Ubuntu/Debian):

1. Clone your repository onto the server:
   ```bash
   git clone https://github.com/YOUR_GITHUB_USERNAME/vathan-minerals.git
   cd vathan-minerals
   ```
2. Start the full application and MySQL database in production:
   ```bash
   docker compose up -d --build
   ```
3. The platform will immediately be live on `http://YOUR_SERVER_IP:4000`.

---

## 🔐 Environment Variables Reference

| Variable | Description | Example / Default |
| :--- | :--- | :--- |
| `NODE_ENV` | Environment mode | `production` |
| `PORT` | HTTP port | `4000` (or `10000` on Render) |
| `DATABASE_URL` | Cloud MySQL connection string | `mysql://user:pass@host:3306/db` |
| `DB_HOST` | Database host (if not using DATABASE_URL) | `127.0.0.1` |
| `DB_PORT` | Database port | `3306` |
| `DB_USER` | Database user | `root` |
| `DB_PASSWORD` | Database password | `Ferrari#9car` |
| `DB_NAME` | Database name | `barytes_management` |
| `DB_SSL` | Enable SSL for cloud database connection | `true` |
| `JWT_SECRET` | Secret key for signing authentication tokens | (32+ character random string) |
| `ADMIN_NAME` | Administrator full name | `Maddela Venkata Subbaiah` |
| `ADMIN_EMAIL` | Administrator login email | `admin@vathanminerals.com` |
| `ADMIN_PASSWORD` | Initial admin password | `ChangeMe_123456` |
| `WEBAUTHN_RP_ID` | Domain name for biometric sensor | `your-app.onrender.com` |
| `WEBAUTHN_ORIGIN` | Full origin URL for WebAuthn | `https://your-app.onrender.com` |

---

## 📷 Note on Biometrics (Face & Fingerprint) in Cloud

* **Camera & Facial Recognition:** Modern browsers require an **HTTPS** connection (or localhost) to grant camera access (`navigator.mediaDevices.getUserMedia`). Render and Railway automatically provision free SSL/TLS certificates, so the camera will work seamlessly on all phones, tablets, and computers.
* **Fingerprint Sensor (WebAuthn):** WebAuthn also requires **HTTPS**. Once your cloud domain is live (e.g. `https://vathan-minerals.onrender.com`), set:
  * `WEBAUTHN_RP_ID = vathan-minerals.onrender.com`
  * `WEBAUTHN_ORIGIN = https://vathan-minerals.onrender.com`
