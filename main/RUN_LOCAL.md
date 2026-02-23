# How to Run Aura VMS Locally

This project is configured to run with a **SQLite** fallback for easy local development, so you don't need to configure PostgreSQL unless you want to.

## Prerequisites
- Node.js (v20+ recommended)
- npm

## 1. Setup & Run Backend
1. Open a terminal in the `server` directory:
   ```bash
   cd server
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. (Optional) Run the seed script to populate test data:
   ```bash
   node src/seed.js
   ```
4. Start the server:
   ```bash
   npm run dev
   ```
   *The server will run on [http://localhost:5001](http://localhost:5001)*

## 2. Setup & Run Frontend
1. Open a **new** terminal in the `client` directory:
   ```bash
   cd client
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the Vite development server:
   ```bash
   npm run dev
   ```
   *The frontend will be available at [http://localhost:5173](http://localhost:5173)*

---

## 🔐 Default Login Credentials (if seeded)

| Role | Username | Password |
| :--- | :--- | :--- |
| **Admin** | `admin` | `admin123` |
| **Guard** | `guard` | `guard123` |

## 🛠️ Testing the Flow
1. **Visitor Kiosk**: Go to `http://localhost:5173/` and enter a UHID (e.g., `UHID-1001`) to generate a slip.
2. **Guard Portal**: Go to `/guard/login` to verify slips.
3. **Admin Dashboard**: Go to `/admin` to manage the system.
