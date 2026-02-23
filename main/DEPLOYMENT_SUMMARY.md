# Action Care Hospital: Deployment Post-Mortem & Resolution Guide

This document summarizes the technical challenges encountered during the migration of the Hospital Visitor Management System to **DigitalOcean App Platform** and how they were resolved.

---

## 1. Multi-Repo Split
- **Issue**: The original project was a monorepo, making it difficult for DigitalOcean to handle independent build processes and scaling for frontend vs. backend.
- **Why**: DigitalOcean App Platform works best with repositories that have a clear entry point (e.g., a root-level `package.json` or `Dockerfile`).
- **Solution**: Refactored the project into two standalone GitHub repositories:
    1. `hospital-visitor-management-backend`
    2. `hospital-visitor-management-frontend`

## 2. Database SSL Handshake (`SELF_SIGNED_CERT_IN_CHAIN`)
- **Issue**: The backend failed to connect to DigitalOcean's Managed PostgreSQL with the error `SELF_SIGNED_CERT_IN_CHAIN`.
- **Why**: DigitalOcean's managed databases use self-signed certificates. Node.js's security policy rejects these by default unless explicitly configured otherwise.
- **Solution**: 
    - Updated `server/src/config/database.js` to include `dialectOptions: { ssl: { rejectUnauthorized: false } }`.
    - Added `process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'` at the global database entry point to ensure both the API and the Seeding script bypass the check.

## 3. Seed Script Execution Failure
- **Issue**: Database seeding failed in production even after the server fix.
- **Why**: The SSL fix was initially in `app.js`. The `seed.js` script runs as a standalone process and does not import `app.js`, thus missing the SSL bypass.
- **Solution**: Centralized the SSL bypass at the top of the database configuration file (`database.js`), which is used by both the server and the seeding script.

## 4. Nginx Upstream "Host Not Found"
- **Issue**: The frontend container crashed with an Nginx error: `host not found in upstream "server"`.
- **Why**: The legacy Nginx configuration was designed for a Docker Compose environment where the backend container was named "server". In individual repos on DigitalOcean, there is no internal "server" host.
- **Solution**: Removed the Nginx reverse proxy. Configured the React app to communicate directly with the live Backend URL over the internet.

## 5. Nginx `SIGIO` Signal Errors (502/504)
- **Issue**: Frontend logs showed repetitive `signal 29 (SIGIO) received` crashes, leading to a Gateway Timeout (504) or a 502 error.
- **Why**: There is a known kernel-level compatibility issue between the Nginx Alpine image and certain cloud runtimes (like DigitalOcean's gVisor-based platform).
- **Solution**: 
    - Initial attempt: Switched to `nginx:mainline` (Debian-based).
    - Final Resolution: Replaced Nginx entirely with a lightweight Node.js static server (**`serve`**) to bypass kernel-level signals.

## 6. Vite Environment Variables (Build-Time Sinkhole)
- **Issue**: The frontend was live but couldn't talk to the backend.
- **Why**: Vite "bakes" environment variables into the JavaScript files during the build phase. Simply setting them in the DigitalOcean dashboard at runtime doesn't work for Docker builds unless passed through correctly.
- **Solution**: Updated the `Dockerfile` to include `ARG VITE_API_URL` and `ENV VITE_API_URL=$VITE_API_URL` to ensure the value was injected during `npm run build`.

## 7. Migration to Standard Static Site Hosting
- **Issue**: Persistent 504 Gateway Timeouts despite healthy logs.
- **Why**: Standard web service containers for simple static folders add unnecessary complexity and routing overhead.
- **Solution**: Abandoned Docker for the frontend and switched to DigitalOcean's native **"Static Site"** resource. This uses a global CDN, handles SPA routing (unknown paths -> index.html) automatically, and is more cost-optimized.

## 8. CORS Trailing Slash Conflict
- **Issue**: Login requests were blocked by CORS even though the origin looked correct.
- **Why**: The `CORS_ORIGIN` in the backend was set to `https://lobster...app/` (with a trailing slash), but browsers send the origin as `https://lobster...app` (without the slash). They must match exactly.
- **Solution**: Removed the trailing slash from the `CORS_ORIGIN` environment variable in the DigitalOcean dashboard.

---

### **Current Production Status**
- **Backend**: Healthy and connected to PostgreSQL.
- **Frontend**: Live on CDN with SPA routing support.
- **Connectivity**: Verified (Guard Login and Admin Login fully operational).
