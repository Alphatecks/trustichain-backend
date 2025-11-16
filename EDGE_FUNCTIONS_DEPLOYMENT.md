# Supabase Edge Functions Deployment

## What are Edge Functions?

Supabase Edge Functions are serverless functions that run on Deno at the edge. They're perfect for API endpoints and integrate seamlessly with Supabase.

## Advantages of Edge Functions

✅ **No server management** - Fully serverless  
✅ **Auto-scaling** - Handles traffic automatically  
✅ **Built-in Supabase integration** - Direct access to your database  
✅ **Global edge deployment** - Low latency worldwide  
✅ **Cost-effective** - Pay only for what you use  
✅ **Easy deployment** - Single command to deploy  

## Deployment Steps

### 1. Deploy the Register Function

```bash
supabase functions deploy register
```

### 2. Set Up Function URL

After deployment, your function will be available at:
```
https://YOUR_PROJECT_REF.supabase.co/functions/v1/register
```

### 3. Test the Function

```bash
curl -X POST https://YOUR_PROJECT_REF.supabase.co/functions/v1/register \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "fullName": "Test User",
    "password": "Test1234!",
    "confirmPassword": "Test1234!",
    "country": "United States"
  }'
```

## Converting from Express to Edge Functions

### Differences

| Aspect | Express (Node.js) | Edge Functions (Deno) |
|--------|------------------|----------------------|
| Runtime | Node.js | Deno |
| Imports | npm packages | ES modules (esm.sh, deno.land) |
| Server | Express app | serve() function |
| Request/Response | Express req/res | Web API Request/Response |
| Environment | process.env | Deno.env.get() |

### File Structure

```
supabase/functions/
├── register/
│   ├── index.ts      # Main function code
│   └── README.md     # Function documentation
```

## When to Use Edge Functions vs Express

### Use Edge Functions When:
- ✅ Building API-only backend
- ✅ Need serverless auto-scaling
- ✅ Want tight Supabase integration
- ✅ Simple CRUD operations
- ✅ Prefer Deno runtime

### Use Express When:
- ✅ Complex middleware needs
- ✅ Large Node.js ecosystem dependencies
- ✅ Need WebSocket support
- ✅ Long-running background jobs
- ✅ Legacy Node.js codebase

## Migration Path

You can have **both**:
- Keep Express for complex features
- Use Edge Functions for simple CRUD endpoints
- Gradually migrate endpoints as needed

## Deployment Comparison

### Express (Traditional)
```bash
# Deploy to Vercel/Netlify/Railway/etc
npm run build
# Upload to hosting platform
```

### Edge Functions (Supabase)
```bash
supabase functions deploy register
# Done! Auto-deployed globally
```

## Next Steps

1. Deploy the register function: `supabase functions deploy register`
2. Test the endpoint with your frontend
3. Convert other endpoints to Edge Functions as needed
4. Keep Express for complex operations if needed

---

**Recommendation:** For this escrow service, Edge Functions are perfect for most API endpoints. You can always keep Express for complex features or migrate everything to Edge Functions.


