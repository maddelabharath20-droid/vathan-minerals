# Architecture & Engineering Standard
trigger: always_on

## Core Principles
1. **Separation of Concerns**:
   - `frontend/`: Pure client-side React + Vite + Tailwind application. Communicates with backend exclusively via standard JSON REST endpoints or websockets.
   - `backend/`: Node.js Express API. Business logic, database queries, and session management remain strictly in backend.
2. **Component Modularity**:
   - Keep React components focused and cohesive.
   - Shared business components (like `StaffPortal`, `AttendanceManager`, `PlantShowcase3D`) must remain self-contained.
3. **Database Integrity**:
   - Use parameterized queries with MySQL pool. Never concatenate user input into SQL strings.
   - Always return typed numeric values using `decimalNumbers: true`.
