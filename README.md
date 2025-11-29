# trustichain-backend

Blockchain escrow service backend built with Node.js, TypeScript, Express, and Supabase on XRPL.

## Tech Stack

- **Runtime**: Node.js
- **Language**: TypeScript
- **Framework**: Express.js
- **Database**: Supabase (PostgreSQL)
- **Blockchain**: XRPL (XRP Ledger)

## Getting Started

### Prerequisites

- Node.js (v18 or higher)
- npm or yarn
- Supabase account and project

### Installation

1. **Install dependencies:**
```bash
npm install
```

2. **Set up environment variables:**
   - Copy `.env.example` to `.env`
   - Fill in your Supabase credentials:
     - `SUPABASE_URL`: Your Supabase project URL
     - `SUPABASE_ANON_KEY`: Your Supabase anon/public key
     - `SUPABASE_SERVICE_ROLE_KEY`: Your Supabase service role key (optional, for admin operations)
   - Fill in your XUMM (Xaman) API credentials (for wallet signing):
     - `XUMM_API_KEY`: Your XUMM API key (get from https://apps.xaman.dev/)
     - `XUMM_API_SECRET`: Your XUMM API secret (get from https://apps.xaman.dev/)
   - Optional XRPL configuration:
     - `XRPL_NETWORK`: Network to use (`testnet` or `mainnet`, defaults to `testnet`)

3. **Set up Supabase database:**
   - Run the migration file in your Supabase SQL editor:
     - `supabase/migrations/001_create_users_table.sql`

### Running the Application

**Development mode (with hot reload):**
```bash
npm run dev
```

**Build for production:**
```bash
npm run build
```

**Run production build:**
```bash
npm start
```

The API will be available at `http://localhost:3000`

## API Endpoints

### Authentication

#### Register User
- **POST** `/api/auth/register`
- **Body:**
```json
{
  "email": "user@example.com",
  "fullName": "John Doe",
  "password": "SecurePass123!",
  "confirmPassword": "SecurePass123!",
  "agreeToTerms": true,
  "country": "United States"
}
```
- **Note:** `country` is optional. `agreeToTerms` must be `true`.
- **Response:**
```json
{
  "success": true,
  "message": "User registered successfully",
  "data": {
    "user": {
      "id": "user-uuid",
      "email": "user@example.com",
      "fullName": "John Doe",
      "country": "United States"
    }
  }
}
```

### Health Check

- **GET** `/health`
- Returns server status and timestamp

## Project Structure

```
src/
├── config/          # Configuration files (Supabase, etc.)
├── controllers/     # Request handlers
├── middleware/      # Middleware (validation, auth, etc.)
├── models/          # Data models
├── routes/          # API route definitions
├── services/        # Business logic
├── types/           # TypeScript type definitions
└── utils/           # Utility functions
```

## Environment Variables

```env
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
PORT=3000
NODE_ENV=development

# Google OAuth Configuration (for Supabase Auth)
# These are used by Supabase, set them in Supabase Dashboard > Authentication > Providers > Google
SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID=your_google_client_id
SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET=your_google_client_secret

# Backend URL (for OAuth redirects)
# For Render: Use RENDER_URL (automatically set by Render) or set manually
RENDER_URL=https://your-app.onrender.com
# Alternative: Use BACKEND_URL for other hosting platforms
# BACKEND_URL=https://your-production-domain.com
```

## Google OAuth Setup (Render + Supabase Cloud)

### Step 1: Configure Google Cloud Console

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create or select a project
3. Enable **Google+ API** (if not already enabled)
4. Go to **Credentials** → **Create Credentials** → **OAuth 2.0 Client ID**
5. Application type: **Web application**
6. Add **Authorized redirect URIs**:
   - **For local development**: `http://localhost:3000/api/auth/google/callback`
   - **For Render production**: `https://your-app.onrender.com/api/auth/google/callback`
   - **For Supabase**: `https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback`
7. Save and copy the **Client ID** and **Client Secret**

### Step 2: Configure Supabase Cloud Dashboard

1. Go to your [Supabase Dashboard](https://app.supabase.com/)
2. Select your project
3. Navigate to **Authentication** → **Providers**
4. Find **Google** and click to configure
5. Enable Google provider
6. Enter your **Client ID** and **Client Secret** from Google Cloud Console
7. Go to **Authentication** → **URL Configuration**
8. **CRITICAL: Set Site URL** to your base URL (no path):
   - For production: `https://trustichain-backend.onrender.com`
   - For local dev: `http://localhost:3000`
   - This must match your application's base URL exactly
9. **Add Redirect URLs** (must match exactly):
   - `http://localhost:3000/api/auth/google/callback` (for local dev)
   - `https://trustichain-backend.onrender.com/api/auth/google/callback` (for Render)
10. Click **Save** and wait a few seconds for changes to propagate

### Step 3: Configure Render Environment Variables

In your Render dashboard, add these environment variables:

```env
# Supabase (already configured)
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Google OAuth (for Supabase - set these in Supabase Dashboard, not Render)
# These are only needed if you're using local Supabase
# SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID=your_google_client_id
# SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET=your_google_client_secret

# Render automatically sets RENDER_URL, but you can override if needed
# RENDER_URL=https://your-app.onrender.com
```

**Important**: For Supabase Cloud, the Google OAuth credentials are configured in the Supabase Dashboard, not as environment variables in Render. The environment variables in `supabase/config.toml` are only for local Supabase development.

### Step 4: Verify Redirect URLs Match

Ensure these three places have **exactly the same** redirect URL:

1. **Google Cloud Console** → Authorized redirect URIs
2. **Supabase Dashboard** → Authentication → URL Configuration → Redirect URLs
3. **Your code** → Constructed from `RENDER_URL` or `BACKEND_URL` environment variable

The redirect URL format: `https://your-app.onrender.com/api/auth/google/callback`

### Step 5: Troubleshooting

#### Issue: "Missing Authorization Code" Error

If you see an error message saying "The Google OAuth callback is missing the authorization code", this means the redirect URL is not properly configured in Supabase Dashboard.

**Solution:**

1. **Check Supabase Dashboard Configuration:**
   - Go to [Supabase Dashboard](https://app.supabase.com/) → Your Project
   - Navigate to **Authentication** → **URL Configuration**
   - **CRITICAL: Set Site URL** to your base URL:
     - For production: `https://trustichain-backend.onrender.com` (no trailing slash, no path)
     - For local dev: `http://localhost:3000`
   - **Add Redirect URLs** (under the Redirect URLs section):
     - For production: `https://trustichain-backend.onrender.com/api/auth/google/callback`
     - For local dev: `http://localhost:3000/api/auth/google/callback`
   - Both URLs must match **exactly** (including `https://` and the full path)
   - Click **Save** and wait a few seconds

2. **Verify the Redirect URL in Logs:**
   - Check your Render logs when initiating OAuth
   - Look for: `Redirect URL (must be whitelisted in Supabase Dashboard):`
   - Ensure this exact URL is in your Supabase Dashboard redirect URLs list

3. **Common Mistakes:**
   - Missing `https://` prefix
   - Wrong domain (e.g., using `localhost` in production)
   - Missing `/api/auth/google/callback` path
   - Trailing slashes or extra characters

4. **After Adding Redirect URL:**
   - Wait a few seconds for the configuration to propagate
   - Clear your browser cache
   - Try signing in again

**Note:** The redirect URL in Supabase Dashboard is different from Google Cloud Console:
- **Google Cloud Console** should have: `https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback` (Supabase's callback)
- **Supabase Dashboard** should have: `https://your-app.onrender.com/api/auth/google/callback` (Your app's callback)

## Validation Rules

### Registration Validation

- **email**: Valid email format
- **fullName**: 2-100 characters, letters, spaces, hyphens, and apostrophes only
- **password**: 
  - Minimum 8 characters
  - At least one uppercase letter
  - At least one lowercase letter
  - At least one number
  - At least one special character
- **confirmPassword**: Must match password
- **agreeToTerms**: Must be `true` (required)
- **country**: 2-100 characters (optional)

## Development

See `PROJECT_CONTEXT.md` for full project documentation and architecture decisions.

## License

ISC


