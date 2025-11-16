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
```

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


