# Production Smoke Test

Dokumen ini berfungsi sebagai checklist smoke test sebelum release production GAIN. Semua item harus lolos sebelum produk dinyatakan siap go live.

---

## 1. Environment & config

- [ ] `.env` production sudah diisi dengan secret valid.
- [ ] `APP_URL` sesuai domain production.
- [ ] `PORT` tidak konflik dengan proses yang sudah berjalan.
- [ ] Firebase project production dipilih dan benar.
- [ ] Logger / observability output dipasang ke sink yang dapat diakses operasional.
- [ ] API key exchange dan secret disimpan di secret manager, bukan di repo.
- [ ] semua domain authorized Firebase sudah terdaftar.

---

## 2. Firebase production

- [ ] Firebase Auth production aktif.
- [ ] Google provider aktif jika digunakan.
- [ ] Firestore rules deployed ke project production.
- [ ] Firestore indexes deployed ke project production.
- [ ] Storage rules deployed ke production.
- [ ] semua collection path yang diakses user valid.
- [ ] `member_directory` tidak mengandung field sensitif.
- [ ] `wallet_ledger` tetap non-writable dari client.

---

## 3. Authentication smoke test

- [ ] login Google berhasil.
- [ ] login direct demo berhasil.
- [ ] logout membersihkan sesi dan cache lokal.
- [ ] session timeout berlaku setelah 24 jam.
- [ ] unauthorized domain diblokir dengan pesan yang jelas.
- [ ] user tidak bisa mengakses data orang lain.
- [ ] admin role benar-benar terbatas ke admin/super_admin.

---

## 4. Wallet & ledger smoke test

- [ ] saldo awal valid setelah login.
- [ ] deposit validation route berhasil menerima payload valid.
- [ ] deposit invalid menghasilkan validation error.
- [ ] withdraw invalid menghasilkan validation error.
- [ ] transfer invalid menghasilkan validation error.
- [ ] saldo ledger tidak dapat diubah melalui client-only mutation.
- [ ] `wallet_ledger` tidak writable dari client.
- [ ] after transaction, balance reconciliation masih konsisten.
- [ ] no data loss pada `transactions` dan `wallet_ledger`.

---

## 5. Exchange & bot smoke test

- [ ] exchange API key valid.
- [ ] kelebihan rate limit dikembalikan dengan 429.
- [ ] exchange cooldown menghasilkan error yang aman dan bukan leak secret.
- [ ] bot execution tidak memblokir API utama.
- [ ] retry logic menahan error exchange dengan backoff yang wajar.
- [ ] dashboard health dan metrics tidak menunjukkan spike error besar.

---

## 6. Observability & monitoring

- [ ] `/api/health` returns 200.
- [ ] request metrics menampilkan total, failures, slow request.
- [ ] 5xx rate dapat dilihat di log.
- [ ] exchange failure tercatat dengan requestId dan status.
- [ ] modal event dan Web Vitals hanya menyimpan field allowlist.
- [ ] log tidak mengandung email, secret, token, OTP, atau wallet address sensitif.

---

## 7. Recovery & rollback smoke test

- [ ] rollback plan sudah di-draf dan disimpan.
- [ ] restore dari snapshot Firestore berhasil.
- [ ] restore rules/indexes berhasil.
- [ ] environment variables dapat dipulihkan dari secret manager.
- [ ] emergency disable write path dapat dilakukan cepat.
- [ ] incident classification dan escalation jelas.

---

## 8. Final go / no-go decision

Go-live hanya jika semua checklist berikut berhasil:

- [ ] semua P0 selesai
- [ ] smoke test production berhasil
- [ ] no mock data active
- [ ] production rules deployed
- [ ] auth/session hardened
- [ ] monitored and alerting active
- [ ] backup and rollback tested
- [ ] no sensitive data in logs
- [ ] final signoff by owner / operator

Jika salah satu item belum lolos, statusnya tetap `NO-GO`.
