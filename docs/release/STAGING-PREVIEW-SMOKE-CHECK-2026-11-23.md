# Sentinel AI — Staging Preview Smoke Check (2026-11-23)

## Deployment
- Branch: `release/staging-mainline-20261123`
- Commit: `81773d2ca549aecfee93035cff28d866e368c99f`
- Vercel deployment: `dpl_3AnAZsPw6KzckYZSr1aVSH6WefUP`
- Preview URL: https://project-3jyda-git-release-staging-mainline-ddd279-sentinel-ai14.vercel.app/
- Vercel deployment state: READY

## HTTP checks
| Request | Result | Interpretation |
|---|---:|---|
| `/` | 200 OK | Main HTML is served |
| `/sentinel-app.js` | 200 OK | Main application script is served |
| `/sentinel-actions.js` | 200 OK | Delegated action script is served |
| `/sentinel.css` | 200 OK | Main stylesheet is served |
| `/api/scan` using GET | 405 Method Not Allowed | Expected: scan API requires POST |

## Response security headers observed on the HTML response
- Content-Security-Policy present
- Strict-Transport-Security present
- X-Content-Type-Options: nosniff
- X-Frame-Options: DENY
- Referrer-Policy present
- Permissions-Policy present
- Cross-Origin-Opener-Policy present
- Cross-Origin-Resource-Policy present
- X-Robots-Tag: noindex on preview

## Limits of this check
- This was an HTTP smoke check, not a full browser interaction or end-to-end test.
- No authenticated scan POST was sent; no target was scanned and no user data was changed.
- No automated unit/integration test suite result was established by this smoke check.
- The preview currently contains only release documentation changes relative to `main`; no application code was integrated in this staging commit.

## Decision
- Preview deployment and core static asset delivery: PASS.
- Full application behavior, authenticated flows, scanner POST, monitoring, and database integration: NOT YET VERIFIED.
- Do not merge to `main` based on this smoke check alone.


## Follow-up CORS validation (2026-11-23)
- The staging preview built from main's CORS change returns Access-Control-Allow-Origin: https://project-3jyda.vercel.app on /, /sentinel-app.js, and /sentinel.css.
- Current production https://project-3jyda.vercel.app returns Access-Control-Allow-Origin: * on those same resources.
- Production deployment is on commit 0f9f61da9447c40320d91ef4a3f61ce53b84e744; main is one commit ahead at df1764c5ac1ea95e5873e0c8900894c613ba476a. The main commit's CI passed.
- This is a deployment gap, not a failed preview test. Production was not changed.
