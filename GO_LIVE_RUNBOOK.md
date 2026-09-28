# Go Live Runbook

Dokumen ini berfungsi sebagai runbook resmi untuk release production GAIN. Tujuannya adalah memastikan produk hanya masuk ke produksi bila semua gate keamanan, akuntansi, uptime, backup, dan recovery sudah siap.

---

## 1. Release Gate

Sebelum go-live, checklist berikut harus benar-benar terpenuhi:

- [ ] Tidak ada mock data yang aktif di production.
- [ ] Firestore rules sudah di-deploy dan diverifikasi.
- [ ] Storage rules sudah di-deploy dan diverifikasi.
- [ ] Role management final sudah benar.
- [ ] Wallet penuh menggunakan backend ledger yang dipercaya.
- [ ] LocalStorage tidak lagi menjadi source utama state finansial.
- [ ] Audit log aktif dan terkunci ke sink yang layak.
- [ ] Monitoring aktif: API health, latency, 5xx, queue depth, bot failures.
- [ ] Error tracking aktif: Sentry atau layanan sejenis.
- [ ] Setup developer terdokumentasi lengkap.
- [ ] Recovery process terdokumentasi lengkap.
- [ ] Backup strategy terdokumentasi lengkap.
- [ ] Authentication sudah di-hardening.
- [ ] Exchange integration memiliki fallback dan retry logic.
- [ ] Semua transaksi tervalidasi server.
- [ ] Security review selesai.

---

## 2. Pre-Production Checklist

### 2.1 Environment

- `.env` final dibuat untuk production.
- semua secret disimpan di secret manager / environment manager.
- `PORT`, `APP_URL`, `NODE_ENV` diatur dengan benar.
- semua variabel Firebase production telah diisi.

### 2.2 Firebase

- Project production aktif.
- Firestore rules di-deploy ke production.
- Firestore index di-deploy ke production.
- Firebase Authentication domain authorized sudah benar.
- domain produk terdaftar di Authorized Domains.
- storage rules di-deploy.

### 2.3 Exchange & payment infrastructure

- API key exchange disimpan di secret manager.
- mode sandbox/production dipisahkan dengan jelas.
- fallback ke demo/stub hanya boleh aktif di non-production.
- credential tidak boleh dikirim via query string.

### 2.4 Observability

- health endpoint aktif.
- logs dipush ke centralized sink.
- alert rule dibuat untuk 5xx rate, slow request, bot failure, exchange cooldown.
- error monitoring aktif.

---

## 3. Recovery Process

### 3.1 Recovery trigger

Recovery dimulai bila terjadi salah satu kondisi berikut:

- 5xx rate melebihi threshold.
- banyak error auth / domain misconfig.
- ledger mismatch atau saldo tidak konsisten.
- order atau withdrawal tidak berhasil secara massal.
- bot engine gagal berkali-kali dan membentuk backlog besar.
- data Firestore corruption / permission error / missing index.

### 3.2 Immediate containment

1. Freeze risky writes:
   - non-essential write path ditutup.
   - admin action dibatasi.
   - exchange write APIs di-disabled jika ada risiko keamanan.
2. Freeze bot execution:
   - bot engine dimatikan sementara.
   - queue dibatasi agar tidak menumpuk lebih banyak task.
3. Snapshot system state:
   - export Firestore snapshot.
   - simpan env + config + recent deployment metadata.
   - simpan log error dan metric window terakhir.

### 3.3 Root cause diagnosis

- cek server logs dan request metrics
- cek Firestore permission error
- cek exchange API credentials dan cooldown status
- cek apakah issue berasal dari frontend/localStorage atau backend
- cek apakah ledger mismatch terjadi di read-model atau production source-of-truth

### 3.4 Rollback

Rollback dilakukan bila:

- patch baru menyebabkan data corruption
- auth issue di production
- bug pada payment/withdrawal/transfer

Langkah rollback:

1. revert ke tag release sebelumnya
2. deploy ulang config dan env yang aman
3. kembalikan rules/indexes yang valid
4. aktifkan service yang tertutup
5. jalankan smoke test login, wallet, & trade history

### 3.5 Post-incident validation

Setelah recovery:

- all health endpoint berstatus OK
- login berhasil
- wallet dan transaksi terbaca dengan benar
- market data dan bot engine tidak error
- audit event masih lengkap
- no sensitive data exposed in logs

---

## 4. Backup Strategy

### 4.1 Database backup

- Firestore export otomatis rutin via scheduled export.
- Export disimpan ke bucket cloud storage terpisah.
- Simpan snapshot harian dan snapshot sebelum deployment.
- Simpan file rules/indexes versi stabil.

### 4.2 Deployment backup

- semua deploy diberi git tag / release tag.
- semua environment variables disimpan di secret manager.
- backup konfigurasi Firebase dan hosting disimpan secara terpisah.

### 4.3 Secret backup

- secret disimpan di secret manager yang terenkripsi.
- jangan simpan secret di repository.
- akses secret dibatasi ke role tertentu.

### 4.4 Recovery restore plan

1. restore Firestore snapshot yang paling baru dan aman
2. restore rules/indexes yang valid
3. restore environment / config
4. deploy app versi terakhir yang lolos smoke test
5. verify data integrity and active users

---

## 5. Production Launch Sequence

1. deploy staging mirror
2. run smoke test bawaan
3. deploy production dengan canary / rolling release
4. monitor health + logs selama 30-60 menit
5. aktifkan read traffic penuh dan batasi write jika diperlukan
6. aftercare: review alert, latency, and user reports

---

## 6. Incident Classification

### Sev-1
- data loss / financial corruption
- auth compromise
- wallet balance mismatch
- unauthorized write

Action: immediate containment + freeze + rollback + security response.

### Sev-2
- exchange API downtime
- bot engine outage
- elevated error rate

Action: degrade gracefully + queue tasks + alert ops.

### Sev-3
- minor UI bug / observational false alarms

Action: patch on next maintenance window.

---

## 7. Final go-live rule

Produk dianggap siap go public hanya jika semua gate pada checklist release terpenuhi, semua backup dan recovery plan valid, dan rollback path sudah diuji setidaknya satu kali di staging atau sandbox yang terkontrol.
