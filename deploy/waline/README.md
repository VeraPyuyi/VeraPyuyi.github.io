# Pyuyi Waline service

This directory is the reproducible backend for the site's embedded rich-media comments. Vercel must use
`deploy/waline` as the project root. The frontend stays on GitHub Pages.

## Required deployment settings

1. Connect this repository to Vercel and set the root directory to `deploy/waline`.
2. Add a Neon PostgreSQL database from Vercel Storage. The integration's `DATABASE_URL` is converted in memory to
   the variable names Waline expects; production should override it with a least-privilege `PG_*` role.
3. Run `schema/waline.pgsql` once in the Neon SQL editor.
4. Copy the non-secret values from `.env.example` into Vercel and redeploy. Store database and JWT values as secrets.
5. Visit `<serverURL>/ui/register`; the first account becomes the administrator.
6. Confirm `<serverURL>/api/comment?path=guestbook` returns JSON before switching the public site from Giscus.

The production endpoint is `https://pyuyi-comments.vercel.app`. The server is pinned to `@waline/vercel` 1.41.4,
new comments enter moderation, and verbose SQL logs are disabled because they can contain private comment text or
connection details. Database and administrator credentials must remain in Vercel/Neon and must never be committed.

## Local credential files

- `.env.local` is reserved for the Waline runtime configuration and should use the least-privilege `waline_app` role.
- `.env.neon-admin` is an optional local-only maintenance file containing only the Neon owner role and password.
- A newly downloaded `env.txt` must be renamed to `.env.neon-admin`, given owner-only file permissions, and never
  sourced by the public comment service.

All of these real credential files are ignored by Git. `.env.example` contains names and non-secret defaults only.
