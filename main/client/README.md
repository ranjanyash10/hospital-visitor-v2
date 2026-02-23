# Action Care Hospital - Frontend Terminal (VMS)

This repository contains the high-fidelity visitor management frontend for Action Care Hospital.

## 🚀 Deployment (DigitalOcean App Platform)

1. **GitHub Connection**: Link this repository to a new DigitalOcean "Web Service".
2. **Detection**: DigitalOcean will automatically detect the React code and the `Dockerfile`.
3. **Environment Variables**:
   - `VITE_API_URL`: The URL of your deployed backend (e.g., `https://backend-xyz.ondigitalocean.app`).
4. **Build**: The build process will use the multi-stage `Dockerfile` to create a production-optimized Nginx image.

## 🎨 Design & Features
- **Institutional Branding**: Fully themed for **Action Care Hospital**.
- **Metro-Style Permits**: High-fidelity, printable visitor slips with horizontal precision centering.
- **Kiosk Mode**: Optimized for touch-screen entry terminals.
- **Security Dashboards**: Professional management interfaces for Guards and Administrators.

## 🛠️ Tech Stack
- **Framework**: React 18+ (Vite)
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
- **QR Generation**: react-qr-code
- **Server**: Nginx (Production)

## 📁 Repository Structure
- `/src`: Application components and pages.
- `Dockerfile`: Multi-stage Docker build for Nginx deployment.
- `nginx.conf`: Custom Nginx configuration for SPA routing.

<-m venv Sync demo change -->
