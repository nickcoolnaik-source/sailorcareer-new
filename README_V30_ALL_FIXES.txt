SailorCareer V30 — Master Correction Patch

BASE:
Current SailorCareer V28/V29 repository. Do NOT replace the whole repository with an older V18/V17 package.

REPLACE ONLY THESE 3 FILES:
1. public/index.html
2. public/employer.html
3. public/employer.js

V30 fixes completed:
- Homepage Employer section no longer displays ₹49,999 pricing.
- ₹49,999 appears only inside the secure Employer payment confirmation flow.
- Homepage contact is info@sailorcareer.com only; phone number removed.
- Employer dashboard does not show the subscription price by default.
- Employer Pay Now opens a payment confirmation step showing ₹49,999/month, then Cashfree checkout.
- Cashfree SDK is explicitly loaded on the Employer Portal page.
- Employer login remains available before payment.
- Employer recruitment features remain locked until successful payment AND admin approval.
- Successful payment shows Payment received / Admin review pending.
- Existing approved-but-inactive test accounts can still complete payment; recruitment stays locked until active subscription.
- Employer candidate/resume/vacancy/application actions require active employer subscription.
- Existing master-data job schema handling is preserved: rank_id, vessel_type_id, sector_id.
- Existing Admin V29 approval guard is preserved in api/admin.js: admin approval requires successful employer payment and activation requires verified company + active subscription.
- Existing Seafarer Login, Employer Login, Turnstile, Supabase Auth, dashboard, admin route and Vercel configuration are NOT replaced by this patch.

REGRESSION CHECKS:
- public/employer.js: node --check PASS
- public/index.html: price/contact assertions PASS
- public/employer.html: Cashfree SDK present PASS
- Login buttons and Turnstile script preserved in index.html PASS
- No obsolete employer price card in homepage PASS
- No phone number in homepage contact PASS

DEPLOY:
Upload these 3 files to the ROOT of the existing GitHub repository, replacing the same paths. Commit once. Vercel should auto-deploy.
After deployment use a hard refresh (Ctrl+Shift+R).
