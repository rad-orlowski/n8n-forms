# Security Policy

## Reporting a vulnerability

Please **do not** open a public issue for security vulnerabilities.

Instead, use GitHub's private vulnerability reporting:
**[Report a vulnerability](https://github.com/rad-orlowski/n8n-forms/security/advisories/new)**
(repo → **Security** tab → **Report a vulnerability**).

I'll acknowledge reports as soon as I'm able and work with you on a fix and
coordinated disclosure.

## How this project handles secrets

n8n-forms uses a **BFF (Backend-for-Frontend) server model**. Understanding this
avoids mistaking expected behaviour for a vulnerability:

- **Webhook URLs never leave the server.** `WEBHOOK_<SLUG>` values live in `.env`
  and are read by the Bun/Hono process at runtime. They are not inlined into the
  JS bundle and are never sent to the browser.
- **All n8n calls are server-to-server.** The browser only talks to `/api/*` on
  the BFF; it never contacts n8n directly. n8n's `Allowed Origins` can (and
  should) be restricted to the BFF's host in production — `*` is not required.
- **The source code and `forms/*.form.json5` definitions are safe to publish** —
  they contain no webhook URLs.
- **`.env` is a private key.** If compromised, rotate webhook URLs in n8n and
  update `.env`. The file is gitignored; never commit it or share it.

## Scope

In scope: the form app code and BFF server in this repository.
Out of scope: your n8n instance, workflow configuration, and how you deploy or
restrict access to the BFF — those are operational concerns on your side.
