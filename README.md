# Greater Works City Church (GWCC) Church Management System

A high-performance Church Management System (ChMS) and Member Self-Service Portal built for Greater Works City Church (Joma, Greater Accra, Ghana).

## Deploying to Vercel

The application is pre-configured and 100% ready for Vercel deployment with client-side SPA routing and serverless backend API functions (`/api/health` and `/api/ai/assistant`).

### Method 1: Deploy with Git & Vercel Dashboard (Recommended)

1. **Push your code to GitHub / GitLab / Bitbucket**:
   ```bash
   git add .
   git commit -m "Prepare for Vercel deployment"
   git push origin main
   ```

2. **Import into Vercel**:
   - Go to [vercel.com](https://vercel.com) and log in.
   - Click **"Add New..."** > **"Project"**.
   - Select your repository and click **"Import"**.

3. **Configure Project Settings**:
   - **Framework Preset**: `Vite` (Vercel automatically detects this).
   - **Root Directory**: `./` (default).
   - **Build Command**: `npm run build` (or leave default).
   - **Output Directory**: `dist` (default for Vite).
   - **Install Command**: `npm install` (default).

4. **Add Environment Variables** (in Project Settings > Environment Variables):
   - `GEMINI_API_KEY`: *(Optional but recommended)* Your Google AI Studio API key for real-time generative ministerial AI.
   - `VITE_SUPABASE_URL`: *(Optional)* If syncing data with Supabase Cloud.
   - `VITE_SUPABASE_ANON_KEY`: *(Optional)* Supabase anonymous API key.
   - `VITE_ENABLE_DEMO_AUTH`: *(Recommended: `false` in production)* Disables local/offline demo sign-ins when a secure auth provider is configured.
   - `API_GATEWAY_KEY`: *(Optional)* Protects the backend AI API with a shared secret in production.
   - `ALLOWED_ORIGINS`: *(Optional)* Comma-separated list of trusted frontend origins for API access.

5. **Click "Deploy"**:
   - Vercel will build the frontend into `dist` and automatically deploy the serverless functions in `/api`.
   - Your live URL will be provisioned in ~60 seconds (e.g. `https://your-church-app.vercel.app`).

---

### Method 2: Deploy using Vercel CLI

If you have the Vercel CLI installed on your machine:

1. **Install Vercel CLI** (if not already installed):
   ```bash
   npm i -g vercel
   ```

2. **Login to Vercel**:
   ```bash
   vercel login
   ```

3. **Deploy Preview**:
   ```bash
   vercel
   ```

4. **Deploy to Production**:
   ```bash
   vercel --prod
   ```

5. **Set Environment Variables via CLI**:
   ```bash
   vercel env add GEMINI_API_KEY
   ```

---

## Architecture & Configuration Details

- **`vercel.json`**: Configured with rewrites to route API requests to `/api/*` serverless functions and all other client-side routes to `/index.html` for React Router SPA navigation.
- **`/api/health.js`**: Serverless health check endpoint.
- **`/api/ai/assistant.js`**: Serverless AI endpoint powered by `@google/genai` (`gemini-3.8-flash`) with pastoral resilience fallbacks.
- **PWA & Offline Resilience**: Equipped with offline banners and local storage persistence for uninterrupted church operations during network drops.
