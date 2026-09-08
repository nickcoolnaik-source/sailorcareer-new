SailorCareer V28 – Employer payment-before-approval flow

FINAL EMPLOYER FLOW
1. Employer registration
2. Email verification
3. Employer can log in without payment
4. Employer completes ₹49,999 Cashfree payment
5. Successful employer payment remains pending for admin review
6. Admin can approve only when a successful employer payment exists
7. Admin approval changes company to verified and subscription to active
8. Recruitment features unlock only after both payment and approval

The ₹49,999 fee is shown in the post-registration payment/verification flow, not on the normal employer dashboard.

V28 fixes:
- Employer payment success is pending admin approval, not immediately active.
- Admin approval activates a successfully paid employer subscription.
- Employer login remains available before payment.
- Dashboard shows payment/review state without displaying the ₹49,999 fee.
- Fixed jobs schema usage: rank_id, vessel_type_id, sector_id, contract_duration, experience_required.
- Candidate rank filtering uses seafarer_profiles.rank_id.
- Employer/admin job queries expose master-data names through foreign-key relations.
- Duplicate employer payment attempts are blocked after a successful payment is already awaiting review.

Cross-checks completed:
- Node syntax checks for public JS and all API JS files: PASS
- package.json / vercel.json JSON parse: PASS
- No employer API references to nonexistent jobs.vessel_type/rank/sector columns: PASS
- No employer application query references jobs.vessel_type: PASS
- ZIP integrity: checked before delivery
