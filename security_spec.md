# Security Specification: GAIN Niaga Koin Firestore Architecture

## 1. Data Invariants
1. **User Identity Invariant**: A user document at `/users/{userId}` can only be read, created, or modified by the authenticated user whose `request.auth.uid == userId`.
2. **Subcollection Isolation**: Subcollections `/users/{userId}/positions/{positionId}`, `/users/{userId}/transactions/{transactionId}`, and `/users/{userId}/trade_history/{tradeId}` strictly inherit parent ownership; `request.auth.uid` must match `userId`.
3. **No Cross-User Access**: Users cannot read, list, create, update, or delete another user's wallet balances, positions, or transactions.
4. **ID Sanitization**: Document IDs must adhere to standard length and alphanumeric pattern `^[a-zA-Z0-9_\-]+$` with maximum length of 128 characters.
5. **No Blanket Reads**: All read and list rules evaluate `request.auth.uid == userId` or `resource.data.userId == request.auth.uid`.
6. **Financial Ledger Immutability**: Transactions and Trade History records are strictly append-only; `update` and `delete` operations are permanently blocked to prevent audit trail tampering.
7. **Identity and Member Code Immutability**: On user profile update, `id`, `memberId`, and `createdAt` are strictly immutable.
8. **Non-Negative Balance Invariant**: All wallet balances (`liquidBalance`, `availableCash`, `gasReserve`) and cumulative stats must be non-negative numbers (`>= 0`).
9. **API Credential Transmission Invariant**: API Keys, Secrets, and Passphrases must NEVER be accepted via GET query parameters (CWE-598) and must only be accepted via HTTPS POST request body.
10. **Order Execution Guard Invariant**: All orders must pass server-side rate limits, symbol format checks, side checks (`buy` or `sell`), and finite positive volume bounds.

## 2. The "Dirty Dozen" Payloads (Attacks That Must Be Blocked)
1. **Unauthenticated Read**: Attempting to read `/users/user_abc123` with `request.auth == null` -> `PERMISSION_DENIED`.
2. **Foreign Profile Read**: User `hacker_789` attempting to read `/users/victim_123` -> `PERMISSION_DENIED`.
3. **Foreign Profile Write**: User `hacker_789` attempting to set balance on `/users/victim_123` -> `PERMISSION_DENIED`.
4. **ID Spoofing on Create**: User `attacker` attempting to create `/users/attacker` with `data.id = 'victim_123'` -> `PERMISSION_DENIED`.
5. **Oversized String Injection**: Writing a `username` with length > 64 chars to exhaust database resources -> `PERMISSION_DENIED`.
6. **Subcollection Cross-Write**: User `attacker` attempting to insert a transaction into `/users/victim/transactions/tx_1` -> `PERMISSION_DENIED`.
7. **Foreign Position Manipulation**: User `attacker` trying to force-close or pause `/users/victim/positions/pos_1` -> `PERMISSION_DENIED`.
8. **Malicious Path Variable**: Attempting to write with document ID containing path traversal characters like `../../admin` -> `PERMISSION_DENIED`.
9. **Ghost Field / Shadow Injection**: Writing an unvalidated field `__role: 'admin'` or `isAdmin: true` -> `PERMISSION_DENIED` or ignored.
10. **Type Poisoning**: Sending `liquidBalance: "one million"` as a string instead of number -> `PERMISSION_DENIED`.
11. **Negative Value Tampering**: Forcing negative balances where forbidden -> `PERMISSION_DENIED`.
12. **Blanket Collection Scrape**: Attempting a collection group query on `transactions` without specifying matching `userId` -> `PERMISSION_DENIED`.

## 3. Test Runner
All security assertions in this spec are implemented and enforced by `firestore.rules`.
