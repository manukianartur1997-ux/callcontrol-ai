# CallControl AI

Working Cloudflare deploy skeleton for CallControl AI.

Routes:

- `/` public landing
- `/platform/` product demo
- `/client.html` client workspace
- `/admin.html` operator admin

Auto deploy:

`main` push -> GitHub Actions -> `npx wrangler@latest deploy`.

Required GitHub repository secrets:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
