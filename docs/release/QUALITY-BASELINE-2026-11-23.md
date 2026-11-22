# Sentinel AI — Quality and Security Baseline (2026-11-23)

## Production workflow results on main commit df1764c5ac1ea95e5873e0c8900894c613ba476a

### Mobile Lighthouse
Workflow: Mobile Lighthouse Audit  
Run: https://github.com/kshahwali533-cyber/sentinel-ai/actions/runs/44902695091

| Category / metric | Result |
|---|---:|
| Performance | 100/100 |
| Accessibility | 100/100 |
| Best Practices | 100/100 |
| SEO | 100/100 |
| Largest Contentful Paint | 1.0 s |
| First Contentful Paint | 1.0 s |
| Cumulative Layout Shift | 0.01 |
| Total Blocking Time | 30 ms |

### Production scanner smoke test
Workflow: Production Scanner Smoke Test  
Run: https://github.com/kshahwali533-cyber/sentinel-ai/actions/runs/44902695067

- Target: https://project-3jyda.vercel.app
- Result: HTTP request succeeded.
- Structured checks: 20
- Scanner score: 100/100
- Discovered surface candidates: 4
- Confirmed sensitive-surface findings from unverified links/guessed paths: 0
- Final URL remained on the requested production origin.

### Passive ZAP baseline
Workflow: Production Passive Security Baseline  
Run: https://github.com/kshahwali533-cyber/sentinel-ai/actions/runs/44902695180

- URLs inspected: 16
- PASS: 61
- FAIL: 0
- WARN: 7 warning categories/groups

Warnings observed:
1. Cache-control directives — responses should be reviewed for whether caching is appropriate.
2. X-Content-Type-Options missing on the Vercel Insights script route.
3. Storable/cacheable content — includes public static resources and the Insights script.
4. Retrieved-from-cache notices — public static responses.
5. Permissions-Policy missing on the Vercel Insights script route.
6. Cross-domain misconfiguration — the production deployment at the time returned wildcard CORS on the homepage and static assets.
7. Cross-Origin-Embedder-Policy missing/invalid — not automatically a defect; current COOP/CORP policy deliberately does not require cross-origin isolation.

## Follow-up checks on 2026-11-23
- Production homepage, /sentinel-app.js, and /sentinel.css returned HTTP 200 and wildcard Access-Control-Allow-Origin.
- Staging preview built from main's CORS restriction returned HTTP 200 and Access-Control-Allow-Origin: https://project-3jyda.vercel.app on those same resources.
- Vercel's reserved /_vercel/insights/script.js route returned Access-Control-Allow-Origin: * on both production and preview; the route is platform-served and did not expose the normal app response headers in this check.
- /public/favicon.svg returned HTTP 200; /favicon.svg returned HTTP 404. Keep the existing /public/favicon.svg link.
- Main CI for the CORS commit passed. Production remains one commit behind main and has not been redeployed.

## Assessment
- Current mobile and scanner baselines are strong.
- No ZAP failure was reported; the 7 warnings need classification, not blind suppression.
- The CORS restriction in main is validated in preview but remains pending production deployment.
- Do not add COEP or disable Vercel Insights solely to silence scanner warnings without compatibility and business-impact review.
- This report is a baseline, not proof that the entire product is vulnerability-free.
