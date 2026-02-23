# 🚀 Deployment Guide: GitHub to DigitalOcean

Since we have `main` and `dev` branches, we will use the **DigitalOcean App Platform**. It is the simplest "Senior" way to handle CI/CD, SSL, and scaling without manual server management.

## 1. Preparation
1. Ensure your local `dev` changes are pushed to GitHub.
2. In `client/src/api.js`, we have already updated the URL to be dynamic (`/api`).
3. Have your DigitalOcean account ready and linked to GitHub.

## 2. Deploying the `dev` Environment
We will create a specific app for your teammates to test.

1. Go to the [DigitalOcean Dashboard](https://cloud.digitalocean.com/).
2. Click **Create** -> **Apps**.
3. Select **GitHub** as the source.
4. Choose your repository and select the **`dev`** branch.
5. DigitalOcean will detect the directories. However, to make it seamless, you can **Upload the App Spec**.
    - During the setup, look for "Edit Spec" or "Import Spec".
    - Copy-paste the content of `deployment/do-app.yaml`.
    - **Note**: Update `repo: REPLACEME` in the YAML to your actual `username/repo`.
6. Set the **Environment Variables** in the UI:
    - `JWT_SECRET`: Generate a random long string (e.g., `openssl rand -base64 32`).
7. Click **Create Resources**.

## 3. The "Main" (Production) Environment
Once testing is done on `dev`:
1. Merge `dev` into `main` on GitHub.
2. Create a **Second App** in DigitalOcean called `vms-prod`.
3. Point it to the **`main`** branch.
4. Use the same configuration (or a slightly larger database/instance size if needed).

## 💡 Why this works
- **Autodeploy**: Every time you push to `dev`, the `dev` app updates automatically.
- **Nginx Proxy**: Our `client/Dockerfile` uses Nginx to serve the React app and proxy `/api` calls to the `server` component. This is already configured in `nginx.conf`.
- **Database**: Each app gets its own isolated Postgres database (free-tier/dev-tier).

## 🔐 Security Checks
- **JWT_SECRET**: Use a different secret for `dev` and `prod`.
- **CORS_ORIGIN**: Once you have a domain, change `*` to your actual URL in the `do-app.yaml`.
