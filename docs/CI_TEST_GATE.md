# CI test gate — apply this yourself in GitHub

**Why:** `.github/workflows/deploy-cloudflare.yml` currently deploys the Worker to
production with **zero tests run** — a broken tenant-isolation policy or a
regressed `migration_required` guard would deploy unblocked. The completeness
audit flagged this as a medium risk.

**Why you have to apply it, not me:** the local push credential lacks the
`workflow` scope, so a commit that touches `.github/**` is rejected and would
block the whole push. So this change has to be made through the GitHub web UI
(or by someone whose token has `workflow` scope).

## Minimal gate (recommended — no services needed)

Add ONE step to `.github/workflows/deploy-cloudflare.yml`, right after
**Install dependencies** and before **Build static assets**:

```yaml
      - name: Run worker tests
        run: npm run test:saas
```

That runs the 228 Node tests (which cover the `migration_required` guards, the
billing meter, STT dispatch, the reingest route, SSRF, purge, etc.). If any
fail, the deploy stops.

## Stronger gate (optional — adds the RLS isolation suite)

The Postgres RLS suite (`saas/test/run.sh`, the tenant-isolation gate) needs a
Postgres service. Add it as a **separate job** the deploy depends on:

```yaml
jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: cc
        ports: ["5432:5432"]
        options: >-
          --health-cmd "pg_isready -U postgres" --health-interval 5s
          --health-timeout 5s --health-retries 10
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - run: npm ci
      - run: npm run test:saas
      # Apply the numbered migrations + shim, then the RLS suite, against the
      # service Postgres (run.sh uses docker exec locally; in CI point psql at
      # the service instead — or keep run.sh and use a docker-in-docker step).

  deploy:
    needs: test          # <-- deploy only if tests pass
    runs-on: ubuntu-latest
    permissions:
      contents: read
    steps:
      # ... the existing deploy steps, unchanged ...
```

The minimal gate alone already closes the audit finding; the RLS job is a
belt-and-suspenders upgrade you can add later.
