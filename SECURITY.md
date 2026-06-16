# Security Policy

## Reporting a vulnerability

Please **do not** open a public issue for security vulnerabilities.

Instead, use GitHub's private vulnerability reporting:
**[Report a vulnerability](https://github.com/rad-orlowski/n8n-forms/security/advisories/new)**
(repo → **Security** tab → **Report a vulnerability**).

I'll acknowledge reports as soon as I'm able and work with you on a fix and
coordinated disclosure.

## Important: how this project handles secrets

This is a build-time-inlined, serverless tool. Understanding its model avoids
mistaking expected behavior for a vulnerability:

- **The built `forms.html` contains every webhook URL in plaintext.** This is by
  design — the file is portable and runs from `file://` with no server. Treat the
  built file like a private key: never commit it, never share it publicly, and
  distribute it only to trusted recipients over secure channels.
- **n8n Webhook nodes require `Allowed Origins = *`** so the page works from a
  `null` (`file://`) origin. This means any website can POST to your webhooks.
  Mitigate inside each n8n workflow with payload validation, rate limiting, and
  monitoring. Keep webhook URLs secret.
- **The source code and `forms/*.form.json5` definitions are safe to publish** —
  they contain no webhook URLs (those live only in `.env`, read server-side at
  runtime).

See the **CORS & security implications** and **inlined secrets** sections of the
[README](./README.md) for the full picture.

## Scope

In scope: the form app code in this repository. Out of scope: your own n8n
instance, workflow configuration, and how you distribute the built `forms.html`
— those are operational concerns on your side.
