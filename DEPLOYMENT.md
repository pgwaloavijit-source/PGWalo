# Quick Deployment Guide

## Step 1: Install Dependencies
```bash
npm install
```

## Step 2: Create Cloudflare Resources

### Create D1 Database
```bash
wrangler d1 create pgnest-db
```
Copy the database ID and update `wrangler.toml`:
```toml
[[d1_databases]]
binding = "DB"
database_name = "pgnest-db"
database_id = "YOUR_DATABASE_ID_HERE"
```

### Create R2 Bucket
```bash
wrangler r2 bucket create pgnest-media
```

### Create KV Namespace (Optional)
```bash
wrangler kv:namespace create "CACHE"
```
Copy the namespace ID and update `wrangler.toml`:
```toml
[[kv_namespaces]]
binding = "CACHE"
id = "YOUR_NAMESPACE_ID_HERE"
```

## Step 3: Set Up Secrets
```bash
wrangler secret put JWT_SECRET
```
Enter a secure random string when prompted.

## Step 4: Apply Database Schema
```bash
wrangler d1 execute pgnest-db --file=./database/schema.sql
```

## Step 5: Migrate Initial Data
```bash
npx tsx database/migrate-data.ts > database/data-migration.sql
wrangler d1 execute pgnest-db --file=./database/data-migration.sql
```

## Step 6: Deploy Workers
```bash
npm run build:worker
wrangler deploy
```

## Step 7: Deploy Frontend
Option 1: Using Cloudflare Pages (Recommended)
1. Push code to GitHub
2. Create Cloudflare Pages project
3. Connect repository
4. Set build command: `npm run build`
5. Set output directory: `dist`

Option 2: Direct deployment
```bash
npm run build
npx wrangler pages publish dist --project-name=pgnest-frontend
```

## Step 8: Update Environment
Update `.env` with your Workers URL:
```env
VITE_API_BASE_URL="https://pgnest.YOUR_SUBDOMAIN.workers.dev"
```

## Testing
```bash
# Test health endpoint
curl https://pgnest.YOUR_SUBDOMAIN.workers.dev/api/health

# Test with authentication
curl -H "x-user-role: owner" https://pgnest.YOUR_SUBDOMAIN.workers.dev/api/bootstrap
```

## Troubleshooting
- **Build fails**: Ensure TypeScript is installed and wrangler is configured
- **Database errors**: Check D1 database ID in wrangler.toml
- **Authentication fails**: Verify JWT_SECRET is set
- **CORS errors**: Workers handle CORS automatically, check browser console