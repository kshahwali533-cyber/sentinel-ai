# 07 — Global Readiness, Performance and Mobile

**Status:** Not measured · **Priority:** High · **Release gate:** Yes

## Objective
Measure real usability and reliability across devices, browsers, network conditions and regions. Do not claim global performance without repeatable measurements.

## Tasks
- [ ] **GLB-01 Mobile:** test core flows on small Android/iOS viewports and touch interactions.
- [ ] **GLB-02 Browsers:** test current major mobile and desktop browsers.
- [ ] **GLB-03 Regions:** measure page/API latency from multiple geographic regions and record test locations.
- [ ] **GLB-04 Load:** test concurrency, scan limits, rate limiting, timeouts and graceful overload.
- [ ] **GLB-05 Accessibility:** review keyboard navigation, focus, contrast, labels and readable errors.
- [ ] **GLB-06 Localization:** review language/encoding readiness, dates, time zones and currency-independent UI.
- [ ] **GLB-07 Operations:** verify environment separation, TLS/domains, uptime/error monitoring and rollback procedure.

## Evidence required
Dated performance report with locations and load profile; device/browser matrix; accessibility issue list; rollback exercise.

## Pass criteria
No release-blocking mobile/browser defects; latency and error budgets are explicitly defined and met; overload is controlled; rollback is rehearsed.

## Known starting points
`index.html`, `sentinel-app.js`, `sentinel.css`, `api/`, `.github/workflows/`.

## Completion record
- Test date/locations:
- Devices/browsers:
- Load profile and results:
- Open issues:
- Decision: NOT RUN / BLOCKED / PASS / FAIL
