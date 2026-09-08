# SailorCareer 3.0

New clean Vercel-ready maritime recruitment platform frontend + serverless API foundation.

## Deploy
- Vercel project type: Other
- Root directory: `./`
- Add environment variables from `.env.example`.
- Run `sql/001_schema.sql` in the Supabase SQL editor before enabling production auth/data flows.
- Do not commit real secrets.

## Validation
Run `npm run check` on Node 20+.

This package intentionally separates the public UI from server-side API secrets. Live Supabase/Cashfree/Turnstile functionality requires the user's own production configuration and cannot be truthfully tested without those external accounts.

## V12 document storage
Run `sql/002_documents.sql` once in Supabase SQL Editor to enable the private `seafarer-documents` bucket and document metadata table. Resume upload is available to Free users from My Profile; certificates/documents require an active Seafarer Pro subscription.


V17 stability update: signup now checks for an existing SailorCareer profile before calling Supabase signup, reducing duplicate confirmation-email requests and handling duplicate emails cleanly. Existing login/button handlers are unchanged.


V23 hotfix: corrected employer subscription field to use subscriptions.renews_at, matching the database schema.
