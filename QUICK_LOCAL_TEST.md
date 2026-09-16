# Quick Local Testing Guide

## 🚀 Quick Start (3 Commands)

### 1. Setup Local Environment
```bash
# Windows
npm run local:setup

# Mac/Linux
npm run local:setup:unix
```

### 2. Initialize Local Database
```bash
npm run local:db:init
```

### 3. Start Both Servers
```bash
# Terminal 1: Start Workers backend
npm run dev:worker

# Terminal 2: Start Frontend
npm run dev
```

Then open `http://localhost:3000` in your browser.

## 🧪 Quick Testing

### Test Backend
```bash
# Health check
curl http://localhost:8787/api/health

# Test authentication
curl -X POST http://localhost:8787/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test","role":"owner"}'

# Test data access
curl -H "x-user-role: owner" http://localhost:8787/api/properties
```

### Test Frontend
1. Open `http://localhost:3000`
2. Try logging in/registering
3. Navigate through the app
4. Check browser DevTools for any errors

## 📋 One-Command Testing

```bash
# Run automated API tests
npm run test:worker

# Run database validation
npm run test:db
```

## 🔄 Reset Local Database

```bash
npm run local:db:reset
```

## 🛠️ Manual Setup (If Scripts Fail)

### Step 1: Install Dependencies
```bash
npm install
npm install -g wrangler
```

### Step 2: Setup Database
```bash
wrangler d1 execute pgnest-db --local --file=./database/schema.sql
npx tsx database/migrate-data.ts > database/data-migration.sql
wrangler d1 execute pgnest-db --local --file=./database/data-migration.sql
```

### Step 3: Configure Environment
```bash
echo 'VITE_API_BASE_URL="http://localhost:8787"' > .env
```

### Step 4: Start Servers
```bash
# Terminal 1
wrangler dev

# Terminal 2  
npm run dev
```

## 📊 What's Running

- **Frontend**: `http://localhost:3000` (Vite dev server)
- **Backend**: `http://localhost:8787` (Cloudflare Workers local)
- **Database**: Local SQLite (in `.wrangler/` directory)
- **API Proxy**: Vite proxies `/api/*` to Workers

## 🐛 Troubleshooting

### Port Already in Use
```bash
# Kill process on port 8787
npx kill-port 8787

# Kill process on port 3000
npx kill-port 3000
```

### Database Issues
```bash
# Reset database
npm run local:db:reset

# Manual database check
wrangler d1 execute pgnest-db --local --command="SELECT COUNT(*) FROM properties;"
```

### Workers Won't Start
```bash
# Ensure wrangler is installed
npm install -g wrangler

# Check wrangler version
wrangler --version

# Reinstall if needed
npm uninstall -g wrangler
npm install -g wrangler@latest
```

## 📱 Testing PWA Features

1. Open `http://localhost:3000` in Chrome
2. DevTools → Application → Service Workers
3. Verify service worker is active
4. Test offline mode (Network tab → Offline)
5. Check install prompt in browser toolbar

## 🎯 Key Things to Test

- [ ] Backend health endpoint works
- [ ] Frontend loads without errors
- [ ] Authentication flow works
- [ ] Data loads in UI
- [ ] Media upload works
- [ ] Role-based access works
- [ ] PWA service worker active
- [ ] Offline functionality works

## 📚 Full Documentation

For detailed testing instructions, see `LOCAL_TESTING_GUIDE.md`

## 🚀 Ready for Production?

Once local testing is complete, follow `FULL_DEPLOYMENT_GUIDE.md` for Cloudflare deployment.