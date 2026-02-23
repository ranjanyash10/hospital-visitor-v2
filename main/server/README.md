# Action Care Hospital - Backend Terminal (VMS)

This repository contains the core API terminal logic for the Action Care Hospital Visitor Management System.

## 🚀 Deployment (DigitalOcean App Platform)

1. **GitHub Connection**: Link this repository to a new DigitalOcean "Web Service".
2. **Detection**: DigitalOcean will automatically detect the `Dockerfile` and `package.json`.
3. **Environment Variables**:
   - `DATABASE_URL`: Connection string from your Managed PostgreSQL DB.
   - `JWT_SECRET`: A secure random string for authentication.
   - `CORS_ORIGIN`: The URL of your deployed frontend (e.g., `https://frontend.ondigitalocean.app`).
   - `PORT`: `5000`
4. **Health Check**: Set the health check path to `/health`.

## 🛠️ Tech Stack
- **Engine**: Node.js (v18+)
- **Framework**: Express.js
- **ORM**: Sequelize
- **Database**: PostgreSQL (Production) / SQLite (Local Fallback)
- **Security**: Helmet, JWT, Rate Limiting (Express-Rate-Limit)

## 📁 Repository Structure
- `/src`: Application source code.
- `/database`: Global schema and seed files for institutional initialization.
- `Dockerfile`: Multi-stage Docker build for production efficiency.

## 📦 Database Initialization
When deploying for the first time, use the files in `/database/schema.sql` to initialize your Managed Database tables.
