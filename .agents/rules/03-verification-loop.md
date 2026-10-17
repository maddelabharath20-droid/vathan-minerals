# Verification Loop & Quality Assurance Standard (ECC)
trigger: always_on

## Mandatory Verification Protocol
1. **Never Assume — Always Verify**:
   - Before reporting a task as complete, execute targeted runtime checks (e.g., API status codes, bundle builds, test payloads).
   - Verify both positive cases (valid credentials -> 200 OK) and edge cases (missing params -> 400 Bad Request).
2. **Build Verification**:
   - Run `npm run build` in `frontend/` after frontend edits to catch any compilation, bundling, or JSX syntax errors before deployment.
3. **Cross-Platform Sanity**:
   - Ensure UI elements and authentication flows function reliably across mobile, tablet, and desktop viewports.
