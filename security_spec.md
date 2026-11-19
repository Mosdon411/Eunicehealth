# Security Specification: Eunice Cloud Firestore Access Controls

## 1. Data Invariants
- **Identity Invariance**: A user can only access or modify their own private user profile document `/users/{userId}` and subcollections.
- **Structural Whitelist**: All incoming profile or health records must match strict schemas, enforcing key presence, data types, and length bounds. No extraneous or shadow fields are permitted.
- **Immutability of Key Associations**: The association between subcollection items (such as `userId` or `id`) and their target document contexts must remain constant.

## 2. The "Dirty Dozen" Spoof/Evasion Payloads
Below are 12 specific payloads crafted to probe or exploit common misconfigurations, each of which should return `PERMISSION_DENIED`:

1. **Self-Elevated Privilege Hack (Shadow Profile Update)**: Attempt to inject a non-existent role, e.g. `role: "SuperAdmin"`.
2. **Identity Impersonation (Spoofed UID)**: Try to write to `/users/another-patient-uid` with the request authenticated as `user-xyz`.
3. **Ghost Field Exploit (Extraneous Keys)**: Writing a user profile with an unapproved field `isAdmin: true` to bypass billing checks.
4. **ID Poisoning Attack**: Trying to inject a 10KB special-character sequence (or string exceeding 128 characters) as `reportId`.
5. **Denial-of-Wallet Payload**: Trying to write a `dailySummary` field containing 20MB of noise.
6. **Immutability Breach**: Attempting to update `userId` on an existing report document to transfer it to another context.
7. **Bypassing Verification (Email Spoofing)**: Logging in with an unverified email address and attempting to read or write sensitive medical profiles.
8. **Relational Sync Orphanage**: Creating a `report` child document referencing a parent workspace that doesn't exist.
9. **Status Shortcutting**: Directly setting a report's risk level to a terminal value (e.g., `Critical`) bypasses calculation rules.
10. **Type Injection (False Truths)**: Attempting to update `riskScore` with a Boolean value `true` instead of an integer.
11. **Negative Value Poisoning**: Trying to submit a `riskScore` of `-999` to cause underflow or division-by-zero errors in charts.
12. **PII Leak Exposure**: Attempting to query the entire `/users` collection without specifying an individual owner ID constraint.

## 3. The Rules Specification and Match Matrix
The Firestore Security rules are defined in `/firestore.rules`.
All operations on `/users/{userId}` and nested resources are strictly validated.
- `/users/{userId}` requires `userId == request.auth.uid`.
- `/users/{userId}/reports/{reportId}` requires `userId == request.auth.uid` and valid report properties.
- `/users/{userId}/prescriptions/{prescriptionId}` can be authored by doctors and accessed securely.
- `/users/{userId}/labs/{labId}` can be published by authorized lab personnel.
