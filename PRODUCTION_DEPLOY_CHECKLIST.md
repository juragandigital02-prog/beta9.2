# Production Deploy Checklist & Signoff

> Gunakan satu salinan dokumen ini untuk setiap release. Isi bukti aktual dari environment yang diuji; status `GO` tidak boleh ditetapkan berdasarkan hasil lokal saja.

## 1. Informasi release

| Field | Isi |
|---|---|
| Nama release / versi |  |
| Git tag / commit SHA |  |
| Environment dan domain target |  |
| Firebase project ID production |  |
| Ticket / ringkasan perubahan |  |
| Jadwal deploy dan zona waktu |  |
| Release operator |  |
| Versi release terakhir yang diketahui baik |  |
| Lokasi evidence / catatan deploy |  |

Status per item: `PASS`, `FAIL`, `BLOCKED`, atau `N/A`. Catat owner dan tautan evidence/ticket di kolom terakhir. `N/A` harus disertai alasan; item P0 tidak dapat di-waive.

## 2. Gate sebelum deploy

### 2.1 Build dan kandidat release

| Pemeriksaan | Status | Owner / evidence / catatan |
|---|---|---|
| `npm run lint` berhasil tanpa error |  |  |
| `npm run build` berhasil tanpa error |  |  |
| Hasil build berasal dari commit SHA yang tercatat di atas |  |  |
| Candidate release dan prosedur rollback sudah ditentukan |  |  |

### 2.2 Environment, keamanan, dan data

| Pemeriksaan | Status | Owner / evidence / catatan |
|---|---|---|
| Domain `APP_URL`, `NODE_ENV`, dan konfigurasi Firebase menunjuk ke production yang benar |  |  |
| Secret production tersedia di secret manager/environment manager; nilainya tidak dicetak, ditempel ke tiket, atau disimpan di repo |  |  |
| Kredensial exchange, RPC, dan scanner yang diperlukan tersedia dan sesuai mode production |  |  |
| Authorized domains dan provider Firebase Auth sudah diverifikasi |  |  |
| Tidak ada mock/demo data atau fallback mock yang aktif di production |  |  |
| LocalStorage/cache bukan sumber kebenaran saldo atau state finansial |  |  |
| Wallet/ledger authoritative di backend; mutasi finansial melalui validasi server |  |  |
| Client tidak dapat menulis langsung ke `wallet_ledger` atau mengubah saldo |  |  |
| Payload finansial tidak valid ditolak oleh server; log tidak memuat secret atau PII |  |  |

### 2.3 Firebase production

| Pemeriksaan | Status | Owner / evidence / catatan |
|---|---|---|
| Project ID production telah dikonfirmasi sebelum deploy |  |  |
| Snapshot/backup data production dan salinan konfigurasi/rules/indexes tersedia |  |  |
| Firestore rules terdeploy dan diverifikasi pada project production |  |  |
| Firestore indexes terdeploy dan diverifikasi |  |  |
| Storage rules terdeploy dan diverifikasi |  |  |

Perintah deploy setelah project target dipastikan:

```bash
firebase login
firebase use <production-project-id>
firebase deploy --only firestore:rules,firestore:indexes,storage
```

### 2.4 Backup, monitoring, dan rollback

| Pemeriksaan | Status | Owner / evidence / catatan |
|---|---|---|
| Snapshot Firestore sebelum deploy dapat diakses dan prosedur restore diketahui |  |  |
| Backup environment/config serta rules/indexes tersedia tanpa menaruh secret di repo |  |  |
| Versi aplikasi sebelumnya siap untuk rollback; operator dan langkah rollback diketahui |  |  |
| Rollback/restore pernah diuji di staging atau sandbox terkontrol |  |  |
| Health endpoint, centralized logs, request metrics, dan alert 5xx aktif |  |  |
| Alert exchange cooldown dan bot worker failure aktif atau ditandai N/A dengan alasan |  |  |

### 2.5 Smoke test production

| Pemeriksaan | Status | Owner / evidence / catatan |
|---|---|---|
| Login, logout, session timeout, dan pembatasan unauthorized domain berhasil |  |  |
| User tidak dapat membaca data user lain; akses admin sesuai role |  |  |
| Wallet memuat data production yang benar dan rekonsiliasi ledger konsisten |  |  |
| Validasi deposit, withdraw, transfer, dan activation menolak payload tidak valid |  |  |
| Exchange cooldown/retry dan error ditangani dengan aman; API utama tetap responsif saat bot/exchange bermasalah |  |  |
| Health endpoint mengembalikan HTTP 200/status OK; request metrics terlihat |  |  |
| Log dan telemetry diperiksa: tidak ada secret, token, OTP, email, atau PII yang tidak diizinkan |  |  |

Endpoint health yang diuji: `https://<production-domain>/api/health`  
Waktu pengujian dan hasil/request ID: __________________________________________

## 3. Keputusan sebelum deploy

- [ ] Semua gate P0 di bagian 2 berstatus `PASS` dan punya evidence.
- [ ] Tidak ada item `FAIL` atau `BLOCKED`.
- [ ] Pengecualian `N/A` hanya untuk item non-P0, dengan alasan dan persetujuan Engineering Lead serta Security Reviewer.
- [ ] Product Owner, Engineering Lead, Security Reviewer, dan Release Operator sudah memberi keputusan.

**Keputusan:** `GO` / `NO-GO`  
**Tanggal dan waktu keputusan (zona waktu):** _________________________________  
**Alasan / blocker / ticket pengecualian non-P0:** ______________________________

Aturan keputusan: satu gate P0 yang gagal, belum diverifikasi, atau tanpa evidence berarti `NO-GO`. Jangan mulai deploy production sebelum semua persetujuan wajib dicatat.

## 4. Persetujuan

| Peran | Nama | Keputusan GO/NO-GO | Tanggal/waktu | Tanda tangan / tautan approval |
|---|---|---|---|---|
| Product Owner |  |  |  |  |
| Engineering Lead |  |  |  |  |
| Security Reviewer |  |  |  |  |
| Release Operator / On-call |  |  |  |  |

## 5. Catatan eksekusi dan verifikasi pascadeploy

Isi saat deploy berlangsung. Jalankan kembali smoke test kritis sesudah aplikasi dan konfigurasi production diperbarui.

| Pemeriksaan | Status | Waktu / owner / evidence / catatan |
|---|---|---|
| Backup final dibuat sebelum perubahan production |  |  |
| Rules/indexes/storage rules dan aplikasi terdeploy ke target yang disetujui |  |  |
| `/api/health` HTTP 200 dan status OK setelah deploy |  |  |
| Login serta smoke test wallet/ledger berhasil setelah deploy |  |  |
| Error rate, latency, bot/exchange alerts, dan centralized logs dipantau selama 30-60 menit |  |  |
| Tidak ada mismatch saldo, akses tidak sah, secret leak, atau incident Sev-1/Sev-2 |  |  |

**Hasil akhir:** `RELEASE VERIFIED` / `ROLLBACK REQUIRED` / `INCIDENT OPEN`  
**Keputusan akhir oleh (nama/peran):** _________________________________________  
**Waktu dan tautan ringkasan monitoring:** ____________________________________  
**Jika rollback/incident: versi tujuan, incident/ticket, dan owner:** _______________

## 6. Kriteria NO-GO dan rollback

Tetapkan `NO-GO` sebelum deploy jika build/auth/financial validation gagal, mock data masih aktif, Firebase rules belum benar, backup atau rollback belum siap, monitoring tidak aktif, atau log membocorkan secret/PII. Jika masalah kritis muncul setelah deploy, hentikan write/action berisiko sesuai runbook, lakukan rollback, dan buka incident dengan owner serta evidence.
