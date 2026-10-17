# AGENTS.md — VATHAN MINERALS AI Engineering & Agentic Harness

Welcome to the **VATHAN MINERALS** operational platform. This repository is configured with:
1. **[Agency Agents](https://github.com/msitarzewski/agency-agents)**: Specialized AI personas for architectural design, frontend craft, backend robustness, and reality-checking.
2. **[ECC (Everything Claude Code / Agent Harness Performance Optimization System)](https://github.com/affaan-m/ecc)**: Systematic verification loops, test-driven bug fixes, security gates, and context optimization.
3. **[Awesome Agents (kyrolabs)](https://github.com/kyrolabs/awesome-agents)** (`https://git.mitgai.net/kyrolabs/awesome-agents`): Industry-wide reference directory of AI agent frameworks, memory architectures, evaluation suites, and multi-agent coordination runtimes.
4. **[i-have-adhd (ayghri)](https://github.com/ayghri/i-have-adhd)**: Output shaping and cognition harness that leads with the next action, suppresses tangents, numbers multi-step tasks, and presents high-dopamine, visible wins.

---

## 🏛️ Project Architecture & Invariants

* **Proprietorship Branding**:
  * `Prop : MADDELA VENKATA SUBBAIAH`
  * `VATHAN MINERALS - MINING · Rly Kodur, Andhra Pradesh`
* **Technology Stack**:
  * **Frontend**: React 18 + Vite + Tailwind CSS + Lucide React + Three.js 3D Visualizer.
  * **Backend**: Node.js + Express + MySQL2 pool (`mysql2/promise`) + JWT + bcrypt.
  * **Production Deployment**: Vercel (`vathan-minerals.vercel.app`) with Cloudflare Tunnel proxying `/api/*` to the local mining backend.

---

## 🤖 Active Multi-Agent Roster (`.agents/skills/`)

### 1. Development & Architecture (Agency Agents)
* **`agency-frontend-developer`**: React UI specialist, pixel-perfect Tailwind, responsive mobile layouts, 60fps animations.
* **`agency-backend-architect`**: Express routing, clean controller layers, async error propagation, connection pooling.
* **`agency-software-architect`**: Cross-system boundaries, schema contracts, micro-optimizations, modular designs.
* **`agency-database-optimizer`**: MySQL query optimization, index planning, parameterized queries, zero SQL injection.
* **`agency-minimal-change-engineer`**: Minimal blast-radius edits, zero regressions, preserving docstrings and comments.

### 2. Quality Assurance & Reality Checking (Agency + ECC)
* **`verification-loop`**: Mandatory runtime verification before reporting completion. Never assume a change works without testing.
* **`agency-reality-checker`**: Pragmatic QA checking actual user experiences across mobile, desktop, and unstable networks.
* **`agency-api-tester`**: Automated REST endpoint verification with status code and payload assertions.
* **`tdd-workflow`**: Write reproducing test cases before patching complex bugs.

### 3. Security & Gatekeeping (ECC + Agency)
* **`agency-appsec-engineer`**: Application security, session management, CSRF/XSS prevention, zero-trust endpoint checks.
* **`agency-secrets-engineer`**: Prevents hardcoded credentials, validates `.env` usage, inspects git diffs for token leaks.
* **`delivery-gate`**: Pre-commit checklist ensuring clean builds, active tunnel health, and passing endpoints.

### 4. Cognition & Output Optimization (ayghri)
* **`i-have-adhd`**: Action-first formatting, numbered multi-step execution paths, explicit time estimates, and visible wins.

---

## 🔄 Standard Operational Protocol

1. **Understand & Inspect**: Check running processes (`cloudflared`, `node src/server.js`) and database models before modifying code.
2. **Plan & Execute**: Apply surgical modifications adhering to `01-architecture.md` and `04-minimal-change.md`.
3. **Verify**:
   * Build check: `npm run build` in `frontend/` (must pass with 0 errors).
   * Endpoint check: Test affected `/api/*` endpoints via local/tunnel curl.
4. **Deploy & Sync**:
   * Sync frontend build to root `dist/`.
   * Commit with conventional commit messages (`feat:`, `fix:`, `refactor:`).
   * Push to `main` and `master` branches on GitHub.
