# PGWalo Performance Report

## Environment
Local Vite production build on 2026-09-19. No approved production load environment was used.

## Measured results
- `npm run build`: PASS, 17.34s final run.
- Largest emitted JS chunk: `index-BQgc6yao.js`, 498.62 kB raw / 140.67 kB gzip.
- Other large chunks: `pdfDocuments` 393.37 kB raw / 129.63 kB gzip; `OwnerDashboard` 297.37 kB raw / 69.37 kB gzip.
- PWA precache: about 1.996 MiB across 36 entries.
- p50/p95/p99, throughput, Core Web Vitals, and API latency: NOT TESTED.

## Findings
- Build succeeds and vendor chunks are split.
- Initial payload and PDF/dashboard chunks are substantial for mobile/4G; measure LCP/INP before launch.
- No load harness or representative large dataset was available.

## Recommendations
- Run browser Web Vitals on mid-tier mobile/4G.
- Measure public search, listing detail, bootstrap, payment, and dashboard API p95.
- Verify paginated queries and prevent full-history dashboard loads.
