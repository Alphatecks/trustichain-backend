# Register Edge Function

Supabase Edge Function for user registration.

## Deploy

```bash
supabase functions deploy register
```

## Usage

**Endpoint:** `https://YOUR_PROJECT_REF.supabase.co/functions/v1/register`

**Method:** `POST`

**Headers:**
```
Content-Type: application/json
Authorization: Bearer YOUR_ANON_KEY
```

**Body:**
```json
{
  "email": "user@example.com",
  "fullName": "John Doe",
  "password": "SecurePass123!",
  "confirmPassword": "SecurePass123!",
  "country": "United States"
}
```

**Response:**
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

## Environment Variables

The function automatically uses:
- `SUPABASE_URL` (provided by Supabase)
- `SUPABASE_ANON_KEY` (provided by Supabase)

No additional configuration needed for Supabase-hosted functions.


