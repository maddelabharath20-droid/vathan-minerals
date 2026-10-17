# GEMINI.md — VATHAN MINERALS Project Guidelines

## Identity & Context
- **Organization**: VATHAN MINERALS - MINING
- **Proprietor**: MADDELA VENKATA SUBBAIAH (Rly Kodur, Andhra Pradesh)
- **Harness Systems Connected**: `msitarzewski/agency-agents`, `affaan-m/ecc`, `kyrolabs/awesome-agents`, & `ayghri/i-have-adhd`

## Core Workflow Standards
1. **Always Verify Endpoints**:
   - Backend runs on `http://localhost:4000`.
   - Cloudflare tunnel connects to active tunnel (currently `https://inbox-toll-mid-opportunity.trycloudflare.com`).
   - Frontend is deployed on Vercel at `https://vathan-minerals.vercel.app/`.
2. **Surgical Precision**:
   - Touch only necessary lines.
   - Do not remove or alter proprietor branding.
   - Always run `npm run build` in `frontend/` after React modifications.
3. **Security Standards**:
   - No plaintext passwords in DB; all passwords must use bcrypt.
   - Staff PIN default is `88904`.
   - Admin master password is `Mv@88904`.
   - Keep all database queries parameterized with `pool.execute(...)`.
