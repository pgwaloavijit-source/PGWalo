# PGNest Cloudflare Migration Guide

This guide helps you migrate PGNest from the current Express/Supabase setup to Cloudflare Workers with D1 and R2.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Cloudflare Architecture                   │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐  │
│  │ Cloudflare   │    │ Cloudflare   │    │ Cloudflare   │  │
│  │   Pages      │    │   Workers    │    │      D1      │  │
│  │              │    │              │    │              │  │
│  │ • React App  │◄──►│ • API Routes │◄──►│ • SQL Database│  │
│  │ • Static     │    │ • Auth       │    │ • Tables     │  │
│  │ • PWA        │    │ • CORS       │    │ • Indexes    │  │
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

## Prerequisites

1. **Cloudflare Account**: Sign up at https://dash.cloudflare.com/
2. **Wrangler CLI**: Install globally
   ```bash
   npm install -g wrangler
   ```
3. **Authentication**: Login to Cloudflare
   ```bash
   wrangler login
   ```

## Migration Steps

### 1. Create D1 Database

```bash
# Create D1 database
wrangler d1 create pgnest-db

# Note the database ID from the output and update wrangler.toml
```

Update `wrangler.toml` with your database ID:
```toml
[[d1_databases]]
binding = "DB"
database_name = "pgnest-db"
database_id = "your-actual-database-id"
```

### 2. Run Database Schema Migration

```bash
# Apply the schema to your D1 database
wrangler d1 execute pgnest-db --file=./database/schema.sql
```

### 3. Create R2 Bucket

```bash
# Create R2 bucket for media storage
wrangler r2 bucket create pgnest-media
```

### 4. Create KV Namespace (Optional)

```bash
# Create KV namespace for caching
wrangler kv:namespace create "CACHE"

# Note the namespace ID and update wrangler.toml
```

### 5. Set Up Secrets

```bash
# Set JWT secret for authentication
wrangler secret put JWT_SECRET
# Enter a secure random string when prompted
```

### 6. Migrate Existing Data

```bash
# Generate SQL migration from existing mock data
npx tsx database/migrate-data.ts > database/data-migration.sql

# Apply the data migration
wrangler d1 execute pgnest-db --file=./database/data-migration.sql
```

### 7. Deploy Workers

```bash
# Build the Worker
npm run build:worker

# Deploy to Cloudflare
wrangler deploy
```

### 8. Deploy Frontend to Cloudflare Pages

Option 1: Git Integration
1. Push your code to GitHub/GitLab
2. In Cloudflare Dashboard, create a new Pages project
3. Connect your repository
4. Set build command: `npm run build`
5. Set output directory: `dist`

Option 2: Direct Upload
```bash
# Build the frontend
npm run build

# Deploy using Wrangler Pages
npx wrangler pages publish dist --project-name=pgnest-frontend
```

### 9. Update Environment Variables

Update `.env` file with your Cloudflare Workers URL:
```env
VITE_API_BASE_URL="https://pgnest.your-subdomain.workers.dev"
```

## Configuration Files

### wrangler.toml
Main Cloudflare Workers configuration file that defines:
- Worker entry point
- D1 database bindings
- R2 bucket bindings
- KV namespace bindings
- Environment variables
- Build commands

### database/schema.sql
Complete D1 database schema with all tables, indexes, and default data.

### src/worker/
Cloudflare Workers API implementation:
- `index.ts` - Main Worker entry point
- `handlers/` - API route handlers
- `middleware/` - Authentication and permissions
- `utils/` - CORS, JWT utilities

## API Endpoints

The Workers API maintains compatibility with the existing Express API:

- `GET /api/health` - Health check
- `GET /api/bootstrap` - Load all data (permission-based)
- `POST /api/bootstrap` - Save snapshot (admin only)
- `GET /api/:collection` - Get collection (permission-based)
- `POST /api/:collection` - Create record (permission-based)
- `PUT /api/:collection/:id` - Update record (permission-based)
- `POST /api/media/upload` - Upload media to R2
- `GET /api/media/:filename` - Download media from R2
- `DELETE /api/media/:filename` - Delete media from R2

## Authentication

The Workers support two authentication methods:

1. **JWT Token** (Recommended):
   ```bash
   curl -H "Authorization: Bearer YOUR_JWT_TOKEN" https://pgnest.workers.dev/api/properties
   ```

2. **Header-based** (Legacy compatibility):
   ```bash
   curl -H "x-user-role: owner" -H "x-organization-id: org-demo" https://pgnest.workers.dev/api/properties
   ```

## Testing

### Local Development

```bash
# Start local development server
wrangler dev

# Test health endpoint
curl http://localhost:8787/api/health
```

### Production Testing

```bash
# Test deployed Workers
curl https://pgnest.your-subdomain.workers.dev/api/health

# Test with authentication
curl -H "x-user-role: owner" https://pgnest.your-subdomain.workers.dev/api/bootstrap
```

## Monitoring

Cloudflare provides built-in monitoring:

1. **Workers Analytics**: View request counts, errors, latency
2. **D1 Analytics**: Database query performance
3. **R2 Analytics**: Storage usage and request metrics
4. **Logs**: Real-time logs via `wrangler tail`

```bash
# Tail live logs
wrangler tail
```

## Troubleshooting

### Common Issues

1. **D1 Database Connection Error**
   - Ensure database ID is correct in wrangler.toml
   - Run `wrangler d1 list` to verify database exists

2. **R2 Upload Failed**
   - Ensure bucket name matches in wrangler.toml
   - Check bucket permissions

3. **CORS Errors**
   - Workers automatically handle CORS
   - Check that origin is allowed in your frontend

4. **Authentication Failed**
   - Verify JWT_SECRET is set: `wrangler secret list`
   - Check token expiration

## Rollback Plan

If you need to rollback to the original setup:

1. Keep the original `server.ts` and Supabase configuration
2. Update `.env` to use `VITE_API_BASE_URL="http://localhost:8787"`
3. Run `npm run dev:api` for local development
4. Frontend will automatically use the old API

## Performance Optimization

### D1 Optimization
- Use indexes for frequently queried columns
- Batch operations when possible
- Use prepared statements (already implemented)

### R2 Optimization
- Use cache headers for media files
- Implement CDN caching
- Compress images before upload

### Workers Optimization
- Enable caching for read-heavy endpoints
- Use KV for session storage
- Implement rate limiting

## Cost Estimation

Cloudflare Free Tier (as of 2024):
- **Workers**: 100,000 requests/day free
- **D1**: 5GB storage, 5M reads/day free
- **R2**: 10GB storage, 1M Class A operations/month free
- **KV**: 100,000 reads/day, 1,000 writes/day free

For most PGNest deployments, the free tier should be sufficient.

## Security Considerations

1. **JWT Secret**: Use a strong, random secret
2. **Environment Variables**: Never commit secrets to git
3. **CORS**: Configure allowed origins in production
4. **Rate Limiting**: Implement for production
5. **Input Validation**: Already implemented in Workers

## Next Steps

1. Complete the migration steps above
2. Test all functionality in development
3. Deploy to production
4. Monitor performance and logs
5. Set up alerts for errors
6. Implement backup strategy for D1 data

## Support

For issues specific to:
- **Cloudflare Workers**: https://developers.cloudflare.com/workers/
- **D1 Database**: https://developers.cloudflare.com/d1/
- **R2 Storage**: https://developers.cloudflare.com/r2/
- **Wrangler CLI**: https://developers.cloudflare.com/workers/wrangler/