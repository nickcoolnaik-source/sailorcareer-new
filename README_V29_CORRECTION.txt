SailorCareer V29 – Payment → Admin Approval correction

This is a PATCH for the already deployed V28 codebase. Do NOT replace the repository with an older V18/V17 ZIP.

Required employer flow:
1. Employer registration
2. Email verification
3. Employer can log in before payment
4. Employer dashboard shows Pay Now (no ₹49,999 pricing card)
5. Cashfree payment ₹49,999
6. Successful payment creates/marks employer subscription as pending with provider success event
7. Admin can approve only after successful payment exists
8. Admin approval sets company verified + employer subscription active
9. Recruitment features unlock only after BOTH payment and admin approval

Security correction:
- Admin Activate cannot activate an unapproved/unpaid employer.
- Admin employer list should treat successful-payment/pending-review as "Payment received".
- Homepage pricing remains hidden; ₹49,999 belongs only in the Cashfree payment flow.

Patch files:
- api/admin.js
- public/employer.js
