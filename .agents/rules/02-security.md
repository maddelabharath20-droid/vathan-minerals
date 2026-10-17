# Security & Zero-Trust Guidelines
trigger: always_on

## Critical Security Invariants
1. **Zero Secret Leakage**:
   - Never commit `.env`, private keys, database passwords, or auth secrets to git.
   - Cloudflare tokens and MySQL credentials must be loaded exclusively via `process.env`.
2. **Authentication & Authorization**:
   - Separate Admin role privileges (`admin`, `manager`) from Staff privileges (`staff`).
   - Validate JWT tokens with timing-safe HMAC or official public keys.
   - Staff PINs and passwords must be hashed using bcrypt (10+ rounds).
3. **Input Validation**:
   - Validate incoming request payloads with Zod schemas at route boundaries.
   - Sanitize all string inputs and enforce phone/employee_code pattern matching.
