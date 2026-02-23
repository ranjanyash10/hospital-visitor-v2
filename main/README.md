# Visitor Management System (VMS)

A premium, secure, and production-ready visitor management platform designed for modern healthcare facilities.

## 🚀 Quick Start (Production)

To launch the entire stack (Database, API, and Frontend) in production mode:

```bash
docker-compose up --build
```
The application will be available at `http://localhost`.

## 🏗️ Architecture
- **Frontend**: React (Vite) + Tailwind CSS + Lucide Icons. Served via **Nginx**.
- **Backend**: Node.js (Express) + Sequelize ORM.
- **Database**: PostgreSQL with UUID primary keys.
- **Security**: 
    - JWT-based Opaque Staff Sessions.
    - Bcrypt password hashing (strict enforcement).
    - Rate limiting on all API endpoints.
    - Schema validation via Joi.
    - Protective headers via Helmet.

## 🛠️ Development Setup

### 1. Backend
```bash
cd server
npm install
# Create .env with DATABASE_URL and JWT_SECRET
npm run dev
```

### 2. Frontend
```bash
cd client
npm install
npm run dev
```

## 🛡️ Security Best Practices Implemented
- **One-Visitor-Per-Patient**: Business logic enforced in `slipService.js`.
- **OTP Verification**: Multi-step verification for visitor authenticity.
- **Staff Auth**: Roll-based access control (RBCH) for Guard and Admin portals.
- **Production Containerization**: Multi-stage Docker builds to minimize attack surface.

## 📂 Project Structure
- `/client`: React source and production Nginx config.
- `/server`: Express API and security middleware.
- `/database`: SQL schemas and test seed data.
- `docker-compose.yml`: Local production orchestration.

---
© 2026 Aura Medical Systems. Restricted Access.
