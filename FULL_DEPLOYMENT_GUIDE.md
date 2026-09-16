# Complete PGNest Deployment Guide

This guide covers the complete deployment of PGNest including both the backend (Cloudflare Workers) and frontend (PWA on Cloudflare Pages).

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Complete Deployment Architecture           │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐  │
│  │ Cloudflare   │    │ Cloudflare   │    │ Cloudflare   │  │
│  │   Pages      │    │   Workers    │    │      D1      │  │
│  │              │    │              │    │              │  │
│  │ • React PWA  │◄──►│ • API Routes │◄──►│ • SQL Database│  │
│  │ • Static     │    │ • Auth       │    │ • Tables     │  │
│  │ • SPA Router │    │ • CORS       │    │ • Indexes    │  │
│  │ • Functions  │    │ • JWT        │    │              │  │
│  └──────────────┘    └──────────────┘    └──────────────┘  │
│                              │                              │
│                              ▼                              │
│                    ┌──────────────┐                        │
│                    │ Cloudflare   │                        │
│                    │      R2      │                        │
│                    │              │                        │
│                    │ • Media      │                        │
│                    │ • Images     │                        │
│                    │ • Files      │                        │
│                    └──────────────┘                        │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Phase 1: Backend Deployment (Cloudflare Workers)

### 1.1 Create Cloudflare Resources

```bash
# Login to Cloudflare
wrangler login

# Create D1 database
wrangler d1 create pgnest-db
# Copy the database ID and update wrangler.toml

# Create R2 bucket
wrangler r2 bucket create pgnest-media

# Create KV namespace (optional)
wrangler kv:namespace create "CACHE"
# Copy the namespace ID and update wrangler.toml
```

### 1.2 Update wrangler.toml

Update `wrangler.toml` with your Cloudflare resource IDs:

```toml
name = "pgnest"
main = "src/worker/index.ts"
compatibility_date = "2024-01-01"
compatibility_flags = ["nodejs_compat"]

[vars]
ENVIRONMENT = "production"
DEFAULT_ORGANIZATION_ID = "org-demo-blue-haven"

[[d1_databases]]
binding = "DB"
database_name = "pgnest-db"
database_id = "YOUR_ACTUAL_D1_DATABASE_ID"

[[r2_buckets]]
binding = "MEDIA"
bucket_name = "pgnest-media"

[[kv_namespaces]]
binding = "CACHE"
id = "YOUR_ACTUAL_KV_NAMESPACE_ID"

[build]
command = "npm run build:worker"
cwd = "."

[env.production]
vars = { ENVIRONMENT = "production" }
```

### 1.3 Set Secrets

```bash
# Set JWT secret for authentication
wrangler secret put JWT_SECRET
# Enter a secure random string when prompted
```

### 1.4 Apply Database Schema

```bash
# Apply the schema to your D1 database
wrangler d1 execute pgnest-db --file=./database/schema.sql
```

### 1.5 Migrate Initial Data

```bash
# Generate SQL migration from existing mock data
npx tsx database/migrate-data.ts > database/data-migration.sql

# Apply the data migration
wrangler d1 execute pgnest-db --file=./database/data-migration.sql
```

### 1.6 Deploy Workers

```bash
# Build the Worker
npm run build:worker

# Deploy to Cloudflare
wrangler deploy
```

### 1.7 Test Workers Backend

```bash
# Test health endpoint
curl https://pgnest.YOUR_SUBDOMAIN.workers.dev/api/health

# Test with authentication
curl -H "x-user-role: owner" https://pgnest.YOUR_SUBDOMAIN.workers.dev/api/bootstrap

# Test auth endpoint
curl -X POST https://pgnest.YOUR_SUBDOMAIN.workers.dev/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test","role":"owner"}'
```

## Phase 2: Frontend Deployment (Cloudflare Pages)

### 2.1 Update Environment Configuration

Update `.env` with your Workers URL:

```env
VITE_API_BASE_URL="https://pgnest.YOUR_SUBDOMAIN.workers.dev"
```

### 2.2 Build Frontend

```bash
# Build the React PWA
npm run build
```

### 2.3 Deploy to Cloudflare Pages

**Option 1: Git Integration (Recommended)**

1. Push your code to GitHub/GitLab
2. Go to Cloudflare Dashboard → Pages → Create a project
3. Connect your repository
4. Configure build settings:
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`
   - **Root directory**: `/`
5. Add environment variables:
   - `VITE_API_BASE_URL`: `https://pgnest.YOUR_SUBDOMAIN.workers.dev`
6. Deploy

**Option 2: Direct Upload**

```bash
# Build the frontend
npm run build

# Deploy using Wrangler Pages
npx wrangler pages publish dist --project-name=pgnest-frontend
```

**Option 3: Using Pages Functions**

If you want to use the Pages Functions for API proxying:

1. Ensure `functions/[[path]].js` exists
2. Update `pages.config.json` with your Workers URL
3. Deploy with Git integration or direct upload

### 2.4 Configure Pages Settings

In Cloudflare Pages dashboard:

1. **Custom Domain**: Add your custom domain (optional)
2. **Environment Variables**: Add `VITE_API_BASE_URL`
3. **Headers**: The `_headers` file is automatically applied
4. **Redirects**: The `_redirects` file is automatically applied

## Phase 3: Integration Testing

### 3.1 Test PWA Functionality

```bash
# Deploy and access your Pages URL
# Open browser DevTools → Application → Service Workers
# Verify service worker is registered and active
```

### 3.2 Test API Integration

```bash
# Test that frontend can communicate with Workers
# Open browser console and check network requests
# Verify CORS headers are working correctly
```

### 3.3 Test Authentication Flow

1. Open your deployed PWA
2. Try to login/register
3. Check that JWT token is stored in localStorage
4. Verify that authenticated requests work

### 3.4 Test Media Upload

1. Try uploading an image through the PWA
2. Verify it's stored in R2
3. Check that it can be displayed

## Phase 4: Monitoring and Maintenance

### 4.1 Workers Monitoring

```bash
# Tail live logs
wrangler tail

# View analytics in Cloudflare Dashboard
# Navigate to Workers & Pages → pgnest → Analytics
```

### 4.2 Pages Monitoring

```bash
# View analytics in Cloudflare Dashboard
# Navigate to Workers & Pages → pgnest-frontend → Analytics
```

### 4.3 Database Maintenance

```bash
# Export D1 data for backup
wrangler d1 export pgnest-db --output=backup.sql

# Test database
wrangler d1 execute pgnest-db --file=./database/test-schema.sql
```

## Phase 5: Domain Configuration (Optional)

### 5.1 Custom Domain for Workers

```bash
# Add custom domain to Workers
wrangler domains add your-api.yourdomain.com
```

### 5.2 Custom Domain for Pages

1. In Cloudflare Pages dashboard, go to Custom Domains
2. Add your domain (e.g., `app.yourdomain.com`)
3. Configure DNS records as instructed
4. Wait for SSL certificate provisioning

## Complete API Endpoints

### Workers API (Backend)

| Endpoint | Method | Auth Required | Description |
|----------|--------|---------------|-------------|
| `/api/health` | GET | No | Health check |
| `/api/auth/login` | POST | No | Login and get JWT |
| `/api/auth/register` | POST | No | Register new user |
| `/api/auth/logout` | POST | No | Logout |
| `/api/bootstrap` | GET | Yes | Load all data |
| `/api/bootstrap` | POST | Yes | Save snapshot |
| `/api/:collection` | GET | Yes | Get collection |
| `/api/:collection` | POST | Yes | Create record |
| `/api/:collection/:id` | PUT | Yes | Update record |
| `/api/media/upload` | POST | Yes | Upload media |
| `/api/media/:filename` | GET | No | Download media |
| `/api/media/:filename` | DELETE | Yes | Delete media |

### Collections Available

- `organizations`
- `properties`
- `residents`
- `beds`
- `stays`
- `rent_plans`
- `invoices`
- `payments`
- `payment_allocations`
- `deposit_transactions`
- `notices`
- `checkouts`
- `audit_logs`
- `booking_requests`
- `attendance_records`
- `staff_members`
- `staff_tasks`
- `broadcast_notifications`
- `meal_plans`
- `chat_messages`
- `maintenance_tickets`
- `leads`
- `electricity_meter_readings`
- `security_deposit_records`
- `rent_agreements`
- `visitor_passes`
- `system_settings`
- `role_permissions`

## Troubleshooting

### Workers Issues

**Problem**: Workers deployment fails
- **Solution**: Check TypeScript compilation errors, verify wrangler.toml syntax

**Problem**: D1 connection error
- **Solution**: Verify database ID in wrangler.toml, check D1 exists

**Problem**: Authentication fails
- **Solution**: Verify JWT_SECRET is set, check token generation

### Pages Issues

**Problem**: Build fails
- **Solution**: Check Node.js version, verify dependencies are installed

**Problem**: PWA not working
- **Solution**: Check service worker registration, verify HTTPS (required for PWA)

**Problem**: API requests fail
- **Solution**: Check CORS headers, verify Workers URL is correct

### Integration Issues

**Problem**: Frontend can't reach backend
- **Solution**: Check VITE_API_BASE_URL, verify Workers are deployed

**Problem**: Media upload fails
- **Solution**: Check R2 bucket exists, verify file size limits

## Performance Optimization

### Workers Optimization

1. **Enable caching** for read-heavy endpoints
2. **Use KV** for session storage
3. **Implement rate limiting** for production
4. **Monitor D1 query performance**

### Pages Optimization

1. **Enable Cloudflare CDN** caching
2. **Optimize images** before upload
3. **Minimize JavaScript bundle size**
4. **Use code splitting** (already configured)

### R2 Optimization

1. **Use cache headers** for media files
2. **Implement CDN caching**
3. **Compress images** before upload
4. **Use lifecycle policies** for old files

## Security Checklist

- [ ] JWT_SECRET is set and secure
- [ ] D1 database is not publicly accessible
- [ ] R2 bucket has proper access controls
- [ ] CORS is properly configured
- [ ] Rate limiting is implemented
- [ ] Input validation is in place
- [ ] HTTPS is enforced (automatic on Cloudflare)
- [ ] Environment variables are not exposed
- [ ] Audit logging is enabled
- [ ] Regular backups are scheduled

## Cost Management

### Free Tier Limits (2024)

- **Workers**: 100,000 requests/day
- **D1**: 5GB storage, 5M reads/day
- **R2**: 10GB storage, 1M Class A operations/month
- **KV**: 100,000 reads/day, 1,000 writes/day
- **Pages**: Unlimited bandwidth, 500 builds/month

### Monitoring Usage

```bash
# Check Workers usage
wrangler deployments list

# Check D1 usage
wrangler d1 info pgnest-db

# Check R2 usage
wrangler r2 bucket list
```

## Backup and Recovery

### Database Backup

```bash
# Export D1 database
wrangler d1 export pgnest-db --output=backup-$(date +%Y%m%d).sql

# Import D1 database
wrangler d1 execute pgnest-db --file=backup-20240101.sql
```

### Media Backup

```bash
# List R2 objects
wrangler r2 object list pgnest-media

# Download R2 objects (use rclone or similar tool)
```

## Next Steps

1. **Complete deployment** following this guide
2. **Test all functionality** thoroughly
3. **Set up monitoring** and alerts
4. **Configure custom domains** if needed
5. **Implement CI/CD** for automated deployments
6. **Set up regular backups**
7. **Monitor usage** and optimize performance

## Support

For issues specific to:
- **Cloudflare Workers**: https://developers.cloudflare.com/workers/
- **Cloudflare Pages**: https://developers.cloudflare.com/pages/
- **D1 Database**: https://developers.cloudflare.com/d1/
- **R2 Storage**: https://developers.cloudflare.com/r2/
- **Wrangler CLI**: https://developers.cloudflare.com/workers/wrangler/