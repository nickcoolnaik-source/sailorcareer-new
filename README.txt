SAILORCAREER SEAFARER PRO — ₹499/YEAR + CAREER TOOLKIT

Add to public/:
- pro-tools.js
- pro-tools.css
- pro-plan.js

Load on dashboard.html after dashboard.js:
<link rel="stylesheet" href="/pro-tools.css?v=1">
<script src="/pro-tools.js?v=1"></script>
<script src="/pro-plan.js?v=1"></script>

Load on index.html before </body>:
<script src="/pro-plan.js?v=1"></script>

Add api/pro-tools.js to api/.

Run sql/004_pro_features.sql once in Supabase SQL Editor.

The Cashfree Seafarer Pro amount remains INR 499, but the product copy is now annual: ₹499/year. No amount change is required in api/cashfree-create-order.js; the billing-period/renewal logic should be kept annual when subscription renewal automation is added.

Pro features:
- Sea Service Calculator: vessel, rank, joining/leaving dates and total service calculation
- Certificate Expiry Tracker with 60-day warning
- 80% Complete Profile to Apply gate
- Availability: Available Now / 30 Days / 60 Days / Currently Onboard
- Watchkeeping guidance
- CoC guidance
- DC/CDC guidance
- Course Booking enquiry
- Fresher Seafarer guidance
- Seafarer career guidance
- Service requests saved to Supabase service_requests table

Existing authentication, Supabase, Cashfree, CV, applications and document vault are not replaced by this addon.
