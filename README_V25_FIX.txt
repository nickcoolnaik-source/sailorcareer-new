SailorCareer V25 - Employer dashboard SQL compatibility fix.

Fix: Employer applications query no longer explicitly selects the PostgreSQL/PostgREST reserved aggregate name `rank`, which caused:
"WITHIN GROUP is required for ordered-set aggregate rank"

Preserves V24 company-name dashboard and all previous flows.
Regression checks: employer.js and api/employer.js syntax PASS; Vercel config preserved.
