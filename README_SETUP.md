# README Setup

Panduan lengkap setup proyek GAIN agar berjalan aman di localhost dan siap untuk build produksi.

## 1. Install

### Prasyarat

- Node.js 20.11+ atau 22 LTS
- npm 10+
- Git
- VS Code (disarankan)
- Firebase CLI (untuk emulator dan deploy)

### Install dependency

```bash
npm install
```

Jika ingin menginstal Firebase CLI:

```bash
npm install -g firebase-tools
```

Atau gunakan mode lokal:

```bash
npx firebase-tools --version
```

---

## 2. Environment

Salin file environment contoh menjadi file aktif:

```bash
cp .env.example .env
```

Isi variabel utama berikut:

```env
PORT=3000
APP_URL=http://localhost:3000
GEMINI_API_KEY=""

VITE_FIREBASE_API_KEY=""
VITE_FIREBASE_AUTH_DOMAIN=""
VITE_FIREBASE_PROJECT_ID=""
VITE_FIREBASE_STORAGE_BUCKET=""
VITE_FIREBASE_MESSAGING_SENDER_ID=""
VITE_FIREBASE_APP_ID=""
VITE_FIREBASE_MEASUREMENT_ID=""

GAIN_EXCHANGE_NAME="Binance"
GAIN_EXCHANGE_DEPOSIT_ADDRESS=""
GAIN_HOT_WALLET_ADDRESS=""
GAIN_EXCHANGE_API_KEY=""
GAIN_EXCHANGE_SECRET_KEY=""

RESEND_API_KEY=""
SMTP_HOST=""
SMTP_PORT=587
SMTP_USER=""
SMTP_PASS=""
SMTP_FROM="GAIN Security <security@gainkoin.io>"

ENCRYPTION_MASTER_KEY=""
BSCSCAN_API_KEY=""
BSC_RPC_URL="https://bsc-mainnet.nodereal.io/v1/b2fa3e6d0f654e1fbb7dc66e2b8f71a0"
```

Catatan:
- `PORT` harus unik jika port default 3000 sudah dipakai.
- Jangan commit `.env` ke repository publik.
- `ENCRYPTION_MASTER_KEY` harus berisi kunci rahasia minimal 32 karakter.

---

## 3. Firebase setup

### 3.1 Buat project Firebase

1. Masuk ke Firebase Console.
2. Buat project baru atau gunakan project existing.
3. Aktifkan Authentication.
4. Aktifkan Firestore Database.
5. Aktifkan Storage.
6. Siapkan Hosting (opsional jika ingin deploy ke web).

### 3.2 Konfigurasi Web App

Dapatkan config web Firebase dari project settings > Your apps > Web app.

Masukkan nilainya ke `VITE_FIREBASE_*` di `.env` dan file `firebase-applet-config.json` jika dibutuhkan.

### 3.3 Authorized domains

Buka Firebase Console -> Authentication -> Settings -> Authorized domains.

Tambahkan domain berikut, sesuai environment:

- `localhost`
- `127.0.0.1`
- domain produksi Anda jika sudah live

### 3.4 Email auth / login

Jika memakai Google sign-in atau email/password:

- Aktifkan Google provider di Firebase Authentication.
- Pastikan domain authorized sesuai di atas.
- Jika memakai custom domain, tambahkan domain custom di Authorized domains.

---

## 4. Firestore setup

### 4.1 Deploy rules

Pastikan file `firestore.rules` sudah sesuai dengan arsitektur project. Deploy menggunakan Firebase CLI:

```bash
firebase login
firebase use <project-id>
firebase deploy --only firestore:rules
```

### 4.2 Deploy indexes

```bash
firebase deploy --only firestore:indexes
```

### 4.3 Struktur data utama

Project menggunakan collection berikut:

- `users`
- `users/{uid}/positions`
- `users/{uid}/transactions`
- `users/{uid}/trade_history`
- `users/{uid}/network`
- `users/{uid}/price_alerts`
- `member_directory`

Jika data lama masih ada, pastikan migrasi field timestamp dilakukan sebelum query `orderBy(createdAt)` atau `orderBy(timestamp)` dipakai penuh.

### 4.4 Storage rules

Pastikan `storage.rules` dibuat dan deployed jika aplikasi mengenkripsi atau menyimpan file asset/user upload.

Contoh pattern yang umum dipakai:

```firestore
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /{allPaths=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

---

## 5. Emulator setup

### Install emulator

```bash
firebase init emulators
```

Pilih:
- Firestore Emulator
- Authentication Emulator
- Storage Emulator

### Jalankan emulator

```bash
firebase emulators:start --only auth,firestore,storage
```

Atau untuk semua emulator yang relevan:

```bash
firebase emulators:start
```

### Konfigurasi project agar emulator dipakai

Set variabel environment atau gunakan config local di aplikasi sesuai sistem Firebase web config untuk emulator.

Biasanya emulator digunakan untuk pengujian lokal sebelum production deployment. Pastikan `authDomain` dan project ID sesuai.

---

## 6. Local build

### Development server

```bash
npm run dev
```

Aplikasi akan berjalan di:

```text
http://localhost:3000
```

### Build test

```bash
npm run build
```

### Type check

```bash
npm run lint
```

### Preview build local

```bash
npm run preview
```

---

## 7. Production build

Untuk deploy ke server production, jalankan:

```bash
npm run build
```

Lalu jalankan aplikasi di mode production:

```bash
npm start
```

Catatan:
- di production, environment `.env` harus dipastikan benar dan tidak dibagikan ke publik;
- gunakan domain HTTPS valid;
- setup `APP_URL` sesuai domain produksi;
- Firestore rules dan storage rules harus sudah di-deploy ke project production.

Untuk deploy Firebase Hosting (opsional):

```bash
firebase deploy --only hosting
```

---

## 8. Troubleshooting

### Port 3000 sudah dipakai

```bash
lsof -i :3000
kill -9 <PID>
```

Atau ubah `PORT` di `.env`.

### Firebase auth tidak bisa login

- cek `VITE_FIREBASE_*` benar
- cek `Authorized domains`
- cek project ID sesuai
- cek apakah provider Google diaktifkan

### Firestore permission denied

- cek `firestore.rules` telah di-deploy
- cek akun login sudah terautentikasi
- cek path collection benar: `users/{uid}/...`

### Build gagal

```bash
rm -rf node_modules dist
npm install
npm run build
```

### Emulator tidak terhubung

- pastikan `firebase emulators:start` berjalan
- pastikan project config tidak terarah ke production secara tidak sengaja
- cek `localhost` dan port emulator default

### Exchange API gagal

- cek `GAIN_EXCHANGE_API_KEY` dan `GAIN_EXCHANGE_SECRET_KEY`
- cek `BSC_RPC_URL` dan `BSCSCAN_API_KEY`
- cek konfigurasi passphrase untuk Bitget / OKX
- cek apakah mode `sandbox` atau `live` sesuai kebutuhan

---

## Checklist akhir sebelum go-live

- [ ] `.env` sudah diisi
- [ ] Firebase project sudah dibuat
- [ ] Authorized domains sudah diatur
- [ ] Firestore rules sudah di-deploy
- [ ] Storage rules sudah di-deploy
- [ ] API endpoint sudah aktif
- [ ] SMTP / Resend sudah siap
- [ ] Exchange config valid
- [ ] `npm run lint` berhasil
- [ ] `npm run build` berhasil
- [ ] Aplikasi berjalan di localhost
- [ ] Monitoring & observability aktif

---

## Catatan keamanan

- Jangan menaruh API key dan secret ke repo publik.
- Gunakan secret manager saat deploy ke staging/production.
- Pastikan semua trafik lewat HTTPS.
- Hindari logging data sensitif seperti email, OTP, secret API, token, atau hash transaksi di console aplikasi atau output server.

---

## Referensi cepat

- README utama: `README.md`
- Rules Firestore: `firestore.rules`
- Indexes Firestore: `firestore.indexes.json`
- Config Firebase: `firebase.json`
- App env: `.env.example`
