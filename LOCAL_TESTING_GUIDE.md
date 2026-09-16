# Local Testing Guide for PGNest

This guide shows you how to test the complete PGNest system locally before deploying to Cloudflare.

## Prerequisites

```bash
# Install dependencies
npm install

# Install Wrangler CLI globally
npm install -g wrangler
```

## Local Testing Architecture

```
┌─────────────────────────────────────────────────────────────┐
│              Local Development Architecture                   │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  📱 React Frontend (Vite Dev Server)                        │
│  • Port 3000                                                 │
│  • Hot Module Replacement                                    │
│  • API proxy to Workers                                      │
│                                                              │
│         ↕ (HTTP requests via proxy)                          │
│                                                              │
│  ⚙️ Cloudflare Workers (Local Mode)                          │
│  • Port 8787                                                 │
│  • Local D1 database                                         │
│  • Local R2 (using minio or mock)                            │
│  • JWT authentication                                        │
│                                                              │
│         ↕ (SQL queries)                                      │
│                                                              │
│  🗄️ Local D1 Database                                        │
│  • SQLite backend                                            │
│  • Full schema applied                                      │
│  • Test data populated                                      │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Step 1: Set Up Local Workers Backend

### 1.1 Initialize Local D1 Database

```bash
# Create local D1 database (SQLite-based)
wrangler d1 execute pgnest-db --local --file=./database/schema.sql

# Verify schema was applied
wrangler d1 execute pgnest-db --local --command="SELECT name FROM sqlite_master WHERE type='table';"
```

### 1.2 Populate with Test Data

```bash
# Generate and apply test data
npx tsx database/migrate-data.ts > database/data-migration.sql
wrangler d1 execute pgnest-db --local --file=./database/data-migration.sql
```

### 1.3 Start Local Workers Server

```bash
# Start Workers in local development mode
wrangler dev
```

This will start the Workers server on `http://localhost:8787`

### 1.4 Test Workers Backend

Open a new terminal and test the endpoints:

```bash
# Health check
curl http://localhost:8787/api/health

# Test authentication
curl -X POST http://localhost:8787/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test","role":"owner"}'

# Test data access with headers
curl -H "x-user-role: owner" \
  -H "x-organization-id: org-demo-blue-haven" \
  http://localhost:8787/api/properties

# Test bootstrap endpoint
curl -H "x-user-role: owner" \
  -H "x-organization-id: org-demo-blue-haven" \
  http://localhost:8787/api/bootstrap
```

## Step 2: Set Up Local Frontend

### 2.1 Configure Environment

Create or update `.env` file:

```env
VITE_API_BASE_URL="http://localhost:8787"
```

### 2.2 Start Frontend Development Server

```bash
# Start Vite dev server (in a new terminal)
npm run dev
```

This will start the frontend on `http://localhost:3000`

The Vite config includes a proxy that automatically forwards `/api` requests to the Workers server.

### 2.3 Test Frontend

1. Open `http://localhost:3000` in your browser
2. Test the PWA functionality:
   - Check DevTools → Application → Service Workers
   - Verify the app is installable
   - Test offline functionality

## Step 3: Integration Testing

### 3.1 Test Authentication Flow

1. Open the PWA at `http://localhost:8787`
2. Click on "Login" or "Register"
3. Fill in the form and submit
4. Check browser console for JWT token
5. Verify localStorage contains the token

### 3.2 Test API Communication

1. Open browser DevTools → Network tab
2. Navigate through the PWA
3. Check that API requests are being made to `http://localhost:8787`
4. Verify responses are successful
5. Check that JWT tokens are being sent in headers

### 3.3 Test Media Upload

1. Navigate to a page that allows image upload
2. Try uploading an image
3. Check the Network tab for the upload request
4. Verify the response contains the media URL
5. Check that the image displays correctly

### 3.4 Test Role-Based Access

1. Login as different roles (owner, resident, staff)
2. Verify that you see the appropriate dashboard
3. Check that restricted endpoints return 403 errors
4. Test permission-based UI elements

## Step 4: Database Testing

### 4.1 Query Local D1 Directly

```bash
# List all tables
wrangler d1 execute pgnest-db --local --command="SELECT name FROM sqlite_master WHERE type='table';"

# Count records in key tables
wrangler d1 execute pgnest-db --local --command="SELECT COUNT(*) as count FROM properties;"
wrangler d1 execute pgnest-db --local --command="SELECT COUNT(*) as count FROM residents;"
wrangler d1 execute pgnest-db --local --command="SELECT COUNT(*) as count FROM users;"

# Test specific queries
wrangler d1 execute pgnest-db --local --command="SELECT * FROM properties LIMIT 3;"
wrangler d1 execute pgnest-db --local --command="SELECT * FROM residents WHERE status = 'Active' LIMIT 3;"
```

### 4.2 Test Database Operations

```bash
# Test inserting a new record
wrangler d1 execute pgnest-db --local --command="
  INSERT INTO maintenance_tickets (id, title, category, room_number, resident_name, description, priority, status, created_at)
  VALUES ('test-ticket-1', 'Test Ticket', 'Plumbing', '204', 'Test User', 'This is a test ticket', 'Normal', 'Reported', datetime('now'));
"

# Verify the insert
wrangler d1 execute pgnest-db --local --command="SELECT * FROM maintenance_tickets WHERE id = 'test-ticket-1';"

# Clean up test data
wrangler d1 execute pgnest-db --local --command="DELETE FROM maintenance_tickets WHERE id = 'test-ticket-1';"
```

## Step 5: Run Automated Tests

### 5.1 API Tests

```bash
# Run the Workers API test script
npm run test:worker
```

This will test:
- Health endpoint
- Bootstrap endpoint with different roles
- Collection endpoints
- Media upload functionality

### 5.2 Database Tests

```bash
# Run database schema validation
npm run test:db
```

This will validate:
- All tables exist
- Relationships work correctly
- Default data is present

## Step 6: Test PWA Functionality

### 6.1 Service Worker Testing

1. Open DevTools → Application → Service Workers
2. Verify the service worker is registered and active
3. Check the "Update on reload" checkbox for development
4. Test offline functionality:
   - Go to Network tab → Throttling → Offline
   - Navigate through the app
   - Verify cached content loads

### 6.2 PWA Installation Testing

1. Open Chrome DevTools → Application → Manifest
2. Verify the manifest is valid
3. Look for the install prompt in the browser toolbar
4. Install the PWA and test it as a standalone app

### 6.3 Responsive Design Testing

1. Open DevTools → Device Toolbar
2. Test different device sizes:
   - Mobile (375x667)
   - Tablet (768x1024)
   - Desktop (1920x1080)
3. Verify UI adapts correctly
4. Test touch interactions

## Step 7: Performance Testing

### 7.1 Frontend Performance

1. Open DevTools → Lighthouse
2. Run a Lighthouse audit
3. Check:
   - Performance score
   - PWA criteria
   - Best practices
   - Accessibility

### 7.2 Backend Performance

```bash
# Test response times
time curl http://localhost:8787/api/health
time curl -H "x-user-role: owner" http://localhost:8787/api/properties
time curl -H "x-user-role: owner" http://localhost:8787/api/bootstrap
```

## Step 8: Error Handling Testing

### 8.1 Test Error Scenarios

1. **Invalid Authentication**
   ```bash
   curl -H "x-user-role: invalid" http://localhost:8787/api/properties
   ```

2. **Missing Permissions**
   ```bash
   curl -H "x-user-role: resident" http://localhost:8787/api/users
   ```

3. **Invalid Collection**
   ```bash
   curl http://localhost:8787/api/nonexistent
   ```

4. **Malformed Requests**
   ```bash
   curl -X POST http://localhost:8787/api/properties \
     -H "Content-Type: application/json" \
     -d '{"invalid": "data"}'
   ```

## Step 9: Local R2 Testing (Optional)

For testing R2 locally, you can use MinIO or mock the R2 functionality:

### Option 1: Use MinIO (S3-compatible)

```bash
# Install MinIO
docker run -p 9000:9000 -p 9001:9001 \
  -e "MINIO_ROOT_USER=minioadmin" \
  -e "MINIO_ROOT_PASSWORD=minioadmin" \
  minio/minio server /data --console-address ":9001"

# Update wrangler.toml to use MinIO for local testing
# (This requires additional configuration)
```

### Option 2: Mock R2 in Workers

For local testing, the media handler can use a simple in-memory storage instead of actual R2.

## Step 10: Cleanup and Reset

### Reset Local Database

```bash
# Delete local database
rm -rf .wrangler/state/v3/d1/miniflare-D1DatabaseObject

# Reinitialize
wrangler d1 execute pgnest-db --local --file=./database/schema.sql
npx tsx database/migrate-data.ts > database/data-migration.sql
wrangler d1 execute pgnest-db --local --file=./database/data-migration.sql
```

### Clear Frontend State

```bash
# Clear browser localStorage
# In browser console: localStorage.clear()

# Or use incognito mode for testing
```

## Common Issues and Solutions

### Issue: Workers port already in use

**Solution:**
```bash
# Kill process using port 8787
npx kill-port 8787

# Or use a different port in wrangler.toml
# Add: --port 8788 to wrangler dev command
```

### Issue: CORS errors in development

**Solution:**
The Vite proxy should handle CORS automatically. If you still see errors:
```bash
# Check that Vite proxy is configured correctly in vite.config.ts
# Verify the Workers server is running
# Check browser console for specific CORS errors
```

### Issue: Database not found

**Solution:**
```bash
# Ensure D1 database is created locally
wrangler d1 execute pgnest-db --local --command="SELECT 1;"

# Reapply schema if needed
wrangler d1 execute pgnest-db --local --file=./database/schema.sql
```

### Issue: Frontend can't reach backend

**Solution:**
```bash
# Check that both servers are running
# Workers: http://localhost:8787/api/health
# Frontend: http://localhost:3000

# Verify VITE_API_BASE_URL in .env
# Check Vite proxy configuration
```

## Testing Checklist

Use this checklist to ensure everything works:

### Backend Tests
- [ ] Workers server starts successfully
- [ ] Health endpoint returns 200
- [ ] JWT login/register works
- [ ] Bootstrap endpoint loads data
- [ ] Collection CRUD operations work
- [ ] Permission system enforces access
- [ ] Media upload/download works
- [ ] Error handling works correctly

### Frontend Tests
- [ ] Vite dev server starts
- [ ] PWA loads in browser
- [ ] Service worker registers
- [ ] App is installable
- [ ] All UI components render
- [ ] Authentication flow works
- [ ] API calls succeed
- [ ] Media upload works
- [ ] Responsive design works

### Integration Tests
- [ ] Frontend can communicate with backend
- [ ] JWT tokens are stored and sent
- [ ] Data loads correctly in UI
- [ ] Role-based dashboards work
- [ ] Error handling works end-to-end
- [ ] Offline functionality works

## Next Steps After Local Testing

Once local testing is complete:

1. **Fix any issues** found during testing
2. **Update documentation** with any changes
3. **Prepare for deployment** following the full deployment guide
4. **Test in staging** before production deployment
5. **Monitor production** after deployment

## Development Workflow

For ongoing development:

```bash
# Terminal 1: Start Workers backend
wrangler dev

# Terminal 2: Start frontend
npm run dev

# Terminal 3: Run tests when needed
npm run test:worker
npm run test:db

# Terminal 4: Database operations
wrangler d1 execute pgnest-db --local --command="your query"
```

This setup gives you a complete local development environment that mirrors the production Cloudflare architecture!