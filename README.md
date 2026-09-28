# 🚀 GAIN — Niaga Koin

**GAIN — Niaga Koin** adalah platform *institutional quantitative trading bot & algorithmic settlement vault* yang dilengkapi dengan fitur *100-layer matrix averaging*, grid trading, integrasi multi-exchange (Bitget, Binance, OKX via CCXT), simulasi order, dompet terdesentralisasi/vault, serta transfer internal P2P instan.

---

## 📋 Prasyarat Sistem (Prerequisites)

Sebelum menjalankan aplikasi di komputer lokal melalui Visual Studio Code (VS Code), pastikan sistem Anda telah memenuhi prasyarat berikut:

1. **Node.js**: Versi **v20.11.0+** atau **v22.x LTS** (Sangat direkomendasikan Node.js 22 LTS).
   - Periksa versi Node.js di terminal:
     ```bash
     node -v
     ```
   - *Catatan: Node.js 20.11+ dibutuhkan agar fitur modern ECMAScript seperti `import.meta.dirname` berjalan tanpa kendala.*
2. **NPM**: Versi 10+ (otomatis terpasang bersama Node.js).
   - Periksa versi npm:
     ```bash
     npm -v
     ```
3. **Visual Studio Code**: Versi terbaru.
   - **Rekomendasi Ekstensi VS Code** (Opsional untuk kenyamanan koding):
     - *Tailwind CSS IntelliSense*
     - *Prettier - Code formatter*
     - *ESLint*

---

## 🛠️ Langkah Instalasi di VS Code Lokal

Ikuti langkah-langkah di bawah ini secara berurutan agar aplikasi dapat berjalan tanpa error:

### 1. Buka Proyek di VS Code
- Jalankan terminal dan masuk ke folder proyek, atau klik kanan pada folder dan pilih **Open with Code**.
- Buka Terminal Terpadu di VS Code dengan menekan tombol `` Ctrl + ` `` (Windows/Linux) atau `` Cmd + ` `` (macOS).

### 2. Siapkan File Konfigurasi Environment (`.env`)
Salin file `.env.example` menjadi `.env`:

- **Windows (PowerShell)**:
  ```powershell
  Copy-Item .env.example .env
  ```
- **Linux / macOS / Git Bash**:
  ```bash
  cp .env.example .env
  ```

Isi default pada file `.env`:
```env
# GEMINI_API_KEY: Opsional / Diperlukan jika menggunakan analisis AI Gemini
GEMINI_API_KEY=""

# APP_URL: URL aplikasi
APP_URL="http://localhost:3000"

# PORT: Port server Express & Vite (default: 3000)
PORT=3000
```

> **Tips:** Jika port `3000` di komputer Anda sedang dipakai aplikasi lain, Anda cukup mengubah `PORT=3001` atau nomor port lainnya di dalam file `.env`.

### 3. Pastikan File `firebase-applet-config.json` Tersedia
Aplikasi menggunakan Firebase untuk autentikasi dan database Firestore. Pastikan file `firebase-applet-config.json` berada di root direktori proyek. Format standarnya:

```json
{
  "projectId": "your-firebase-project-id",
  "appId": "your-app-id",
  "apiKey": "your-api-key",
  "authDomain": "your-project.firebaseapp.com",
  "firestoreDatabaseId": "(default)",
  "storageBucket": "your-project.firebasestorage.app",
  "messagingSenderId": "your-sender-id"
}
```
*(File bawaan proyek sudah disediakan, sehingga Anda bisa langsung menjalankannya).*

### 4. Install Dependensi (Node Modules)
Jalankan perintah berikut di terminal VS Code:

```bash
npm install
```

> **Catatan:** Jangan gunakan package manager campuran (misal sebagian dengan yarn/bun) untuk menghindari konflik lockfile. Gunakan `npm install`.

### 5. Jalankan Aplikasi dalam Mode Pengembangan (Development)
Setelah proses instalasi dependensi selesai, jalankan:

```bash
npm run dev
```

Jika berhasil, Anda akan melihat output terminal seperti berikut:
```text
GAIN Server running at http://0.0.0.0:3000
```

### 6. Buka di Browser
Buka browser favorit Anda (Google Chrome / Brave / Edge) dan akses:
👉 **`http://localhost:3000`**

---

## ⚡ Perintah Penting (NPM Scripts)

| Perintah | Fungsi |
| :--- | :--- |
| `npm run dev` | Menjalankan server Express full-stack + Vite middleware di port 3000 |
| `npm run build` | Melakukan compile dan bundle frontend React untuk tahap produksi ke folder `dist` |
| `npm start` | Menjalankan server Express dalam mode produksi menggunakan build `dist` |
| `npm run lint` | Melakukan pengecekan tipe data TypeScript tanpa build (`tsc --noEmit`) |
| `npm run preview` | Meninjau hasil build lokal dengan server Vite bawaan |

---

## 🏗️ Struktur Direktori Proyek

```text
├── public/                     # Asset statis publik (ikon koin SVG, manifest, dll.)
│   └── coins/                  # Ikon cryptocurrency (BTC, ETH, SOL, BNB, dll.)
├── src/                        # Kode sumber frontend React 19
│   ├── components/             # Komponen UI modular
│   │   ├── account/            # Referral, network tree, & profil
│   │   ├── common/             # Logo koin, badge, & tombol umum
│   │   ├── modals/             # Modal deposit, withdraw, transfer P2P, API Key, Matrix
│   │   └── trading/            # Tab order book & riwayat transaksi
│   ├── context/                # AuthContext (Firebase) & ThemeContext (Dark/Light)
│   ├── data/                   # Data mock fallback untuk mode offline/simulasi
│   ├── services/               # Integrasi API & Firebase Firestore service
│   ├── views/                  # Halaman utama: Home, BotMatrix, TradingPositions, Wallet, Account
│   ├── App.tsx                 # Root component aplikasi
│   ├── firebase.ts             # Inisialisasi Firebase Auth & Firestore
│   ├── index.css               # Styling global Tailwind CSS
│   └── main.tsx                # Entry point React DOM
├── server.ts                   # Backend Express (CCXT multi-exchange, bot background engine, API)
├── firebase-applet-config.json # Konfigurasi kredensial Firebase
├── firebase-blueprint.json     # Blueprint skema dokumen Firestore
├── firestore.rules             # Aturan keamanan database Firestore
├── metadata.json               # Metadata aplikasi
├── package.json                # Dependensi dan scripts
├── tsconfig.json               # Konfigurasi TypeScript compiler
└── vite.config.ts              # Konfigurasi bundler Vite & Tailwind CSS
```

---

## ❓ Panduan Pemecahan Masalah (Troubleshooting)

### 1. Error: `EADDRINUSE: address already in use :::3000`
- **Penyebab**: Port 3000 sedang digunakan oleh aplikasi lain di komputer Anda.
- **Solusi A**: Buka file `.env`, ubah `PORT=3000` menjadi `PORT=3005` (atau port kosong lainnya), lalu simpan dan jalankan ulang `npm run dev`.
- **Solusi B**: Matikan proses yang memakai port 3000:
  - **Windows (PowerShell)**:
    ```powershell
    Get-Process -Id (Get-NetTCPConnection -LocalPort 3000).OwningProcess | Stop-Process -Force
    ```
  - **macOS / Linux**:
    ```bash
    kill -9 $(lsof -t -i:3000)
    ```

### 2. Error: `File ... cannot be loaded because running scripts is disabled on this system` (PowerShell Windows)
- **Penyebab**: Kebijakan eksekusi PowerShell membatasi script eksternal `npm`.
- **Solusi**: Buka PowerShell sebagai Administrator dan jalankan perintah:
  ```powershell
  Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
  ```
  Kemudian tutup dan buka kembali terminal VS Code.

### 3. Error: `TypeError: import.meta.dirname is undefined`
- **Penyebab**: Versi Node.js yang terpasang di komputer Anda adalah versi lama (< v20.11.0).
- **Solusi**: Unduh dan perbarui Node.js ke versi LTS terbaru (v22.x) melalui situs resmi [https://nodejs.org/](https://nodejs.org/).

### 4. Pengecekan Integrasi Exchange API (Bitget / Binance / OKX)
- Untuk menghubungkan akun bursa langsung, buka menu **API Key Modal** di aplikasi.
- Masukkan *API Key*, *Secret Key*, dan *Passphrase* (khusus Bitget & OKX).
- Centang mode **Testnet / Demo / Sandbox** jika Anda ingin mencoba tanpa saldo riil.
- Semua kunci API ditransmisikan secara aman melalui HTTPS POST body langsung ke engine server lokal (`server.ts`).

---

## 🛡️ Lisensi & Hak Cipta
Hak Cipta © 2026 **GAIN — Niaga Koin**.
Dibuat dengan React 19, Vite, Express, CCXT, dan Tailwind CSS.
