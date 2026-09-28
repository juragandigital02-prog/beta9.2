# Audit dan Implementasi Member ID

## Ringkasan

Implementasi mengganti ID hash/acak dengan alokasi berurutan `GN-00001`, `GN-00002`, dan seterusnya. ID baru dicadangkan menggunakan transaksi Firestore, reservation per UID, dan dokumen indeks permanen per Member ID. UID Firebase tetap dipakai untuk autentikasi, kepemilikan dokumen, dan path internal; Member ID menjadi identitas bisnis yang dibawa pada profil dan catatan aktivitas. Keduanya tidak seharusnya saling menggantikan.

Perubahan kode inti sudah dibuat dan lolos `npm run lint` serta `npm run build`. Ini belum berarti semua kebutuhan laporan admin, komisi, dan transaksi finansial sudah lengkap atau siap produksi. Ada jalur deposit/withdraw yang saat ini simulasi dan belum menulis ledger, serta tidak ditemukan sistem bonus referral otoritatif yang membuat riwayat komisi terperinci.

## File dan Perubahan

- `src/services/memberService.ts`: validasi format; `reserveMemberId()` memakai transaksi Firestore untuk membaca/menaikkan counter, menghindari ID yang sudah ada, lalu menulis reservation permanen dan indeks unik. Penulisan direktori kini gagal secara nyata jika ditolak Firestore, tidak lagi menelan error.
- `src/services/firebaseService.ts`: inisialisasi mengambil ID dari profil/reservation, bukan hash UID; ID profil valid yang sudah ada dipertahankan. Member ID ditambahkan saat menyimpan transaksi wallet, posisi, dan trade. Direktori referral memakai sponsor ID yang diberikan dan tidak membuat sponsor foundation palsu.
- `firestore.rules`: aturan untuk counter, reservation, dan indeks immutable; validasi format Member ID di profil; update tidak boleh mengganti ID yang sudah terpasang; direktori mensyaratkan ID yang sesuai profil/reservation.
- `src/types.ts`: menambahkan Member ID untuk transaksi, ledger, posisi, trade, serta `sourceMemberId`, `recipientMemberId`, dan `bonusType` untuk metadata riwayat.
- `src/api/walletApi.ts`, `server.ts`: transfer P2P kini memerlukan token Firebase, memeriksa sender terhadap profil terautentikasi, dan mencari penerima di direktori Firestore. Daftar anggota hardcoded di server dihapus.
- `src/components/modals/AuthModal.tsx`: sponsor bisa kosong; jika diisi harus dapat diverifikasi, tanpa pengecualian kode sponsor default yang tidak terdaftar.
- `src/views/WalletView.tsx`, `src/components/trading/TradeHistoryTab.tsx`: menampilkan Member ID pada riwayat transaksi dan trading.
- `src/data/mockData.ts`, `src/components/modals/GasFeeModal.tsx`, `src/components/trading/TradeHistoryTab.tsx`, `src/components/account/NetworkReferralSection.tsx`, `src/components/modals/TransferMemberModal.tsx`: menghapus ID dummy/fallback pada jalur yang disentuh.

## Schema Firestore

Koleksi/dokumen baru:

- `system/member_id_counter`: `{ value: number }`, urutan terakhir yang dialokasikan.
- `member_id_reservations/{uid}`: `{ userId, memberId, sequence, createdAt }`, satu reservasi permanen per akun.
- `member_id_index/{memberId}`: `{ userId, memberId, sequence }`, indeks unik permanen; dokumen tidak dapat diubah/dihapus oleh klien.

Field bisnis yang konsisten:

- `users/{uid}.memberId`: wajib berformat `GN-` + lima digit dan immutable sesudah dibuat.
- `member_directory/{memberId}`: dokumen publik anggota; `sponsorId` berisi Member ID sponsor, bukan UID.
- `users/{uid}/transactions/{id}`: `memberId`; untuk bonus, `sourceMemberId`, `bonusType`, nilai (`amount`), serta timestamp (`createdAt`/`timestamp`).
- `users/{uid}/positions/{id}` dan `users/{uid}/trade_history/{id}`: `memberId`.

Firestore Rules harus dipublikasikan sebelum aplikasi versi ini didistribusikan. Counter awal dan data index/reservation legacy harus disiapkan sebelum alokasi baru aktif di project produksi.

## Integrasi yang Tersedia dan Celah

- Referral: kode referral berbentuk Member ID dan lookup memakai `member_directory/{memberId}`; downline menyimpan `sponsorId` sebagai Member ID. Input kosong berarti tanpa sponsor. Belum ada bonus referral/level/matching yang lengkap atau ledger komisi yang dapat dilacak; jangan menganggap data simulasi sebagai komisi terverifikasi.
- Wallet/trading: write client untuk transaction/trade/position membawa Member ID; bonus aktivasi gas di backend menyertakan penerima, sumber sistem, dan jenis bonus. Deposit dan withdraw server di `server.ts` saat ini hanya menerima/mengantrekan simulasi; belum melakukan settlement serta belum membuat catatan Firestore ledger. Transfer P2P memvalidasi identitas/anggota tetapi endpoint yang ada masih mengembalikan sukses tanpa debit/kredit atomik. Jangan aktifkan aliran dana nyata sebelum ketiga endpoint itu menulis ledger dan saldo dalam transaksi server yang idempoten.
- Admin: pencarian Member ID sudah tersedia pada `AdminUserManagementModal` untuk direktori anggota. Filter lintas deposit, withdraw, bonus, transaksi, referral, dan trading belum tersedia karena tidak ada koleksi ledger terpusat/endpoint query admin untuk seluruhnya. UID tetap dibutuhkan sebagai kunci otorisasi internal.
- Bonus history: UI transaksi menampilkan Member ID penerima dan sumber saat field tersebut ada. Belum ada layar bonus history terpisah maupun model komisi referral lengkap.

## Migrasi Data Lama

Lakukan migrasi sebelum membuka registrasi di produksi:

1. Backup Firestore dan hentikan sementara registrasi/perubahan direktori.
2. Ekspor semua `users` dan `member_directory`; audit format Member ID, ID duplikat, profil tanpa ID, direktori yatim, dan referensi sponsor yang masih UID/dummy.
3. Pertahankan Member ID lama yang valid dan unik agar identitas permanen tidak berubah. Untuk ID kosong/tidak valid, alokasikan ID baru berurutan. Jika duplikat, pilih satu pemilik berdasarkan bukti akun yang otoritatif; alokasikan ID baru ke akun lain dan catat pemetaan UID lama-ke-ID baru untuk audit.
4. Seed `system/member_id_counter` ke sequence tertinggi yang sudah dialokasikan. Buat `member_id_reservations/{uid}` dan `member_id_index/{memberId}` untuk setiap akun; verifikasi satu-ke-satu, lalu sinkronkan `users` dan `member_directory`.
5. Relasikan ulang `sponsorId`/referensi bisnis dari UID ke Member ID melalui pemetaan terverifikasi. Jangan menebak sponsor atau memberi sponsor default tanpa rekonsiliasi.
6. Backfill `memberId` pada transaction, trade, position, bonus, deposit, withdraw, dan ledger lama memakai UID pemilik dokumen sebagai sumber pemetaan. Tambahkan sumber/jenis bonus hanya dari bukti transaksi yang tersedia; nilai yang tidak diketahui harus ditandai, bukan direka.
7. Rekonsiliasi jumlah akun, jumlah ID unik, saldo dan total ledger sebelum membuka registrasi; deploy Firestore Rules, lalu uji dua registrasi serentak, retry akun sama, referral valid/tidak valid, serta akses user/admin.

Jalankan migrasi via Admin SDK/script operator tepercaya, bukan dari browser. Buat dry-run, log pemetaan, dan prosedur rollback sebelum eksekusi. Implementasi repo ini belum menyertakan script migrasi karena project tidak memiliki kredensial/service-account atau pipeline migrasi yang dapat dipakai dengan aman.

## Risiko dan Kriteria Siap Produksi

- ID lama yang memakai hash/acak mungkin bertabrakan atau tidak berurutan; jangan renumber ID valid yang sudah terpublikasi kecuali ada duplikat yang dibuktikan.
- Counter/index/reservation belum ada di database saat ini. Aturan baru saja tidak mengisi data lama; lakukan backfill dan seed.
- Error Rules atau urutan deploy yang salah akan menggagalkan registrasi/direktori; pantau error Firestore setelah deploy.
- Registrasi memakai Google Auth, sedangkan mode demo/local bukan akun bisnis dan tidak mendapat Member ID permanen.
- Sebelum go-live finansial: pindahkan mutasi saldo, transfer, deposit, withdraw, serta komisi ke backend tepercaya dengan transaksi idempoten; bangun skema ledger yang menyimpan Member ID pihak-pihak terkait; sediakan admin API berotorisasi dan indeks Firestore untuk filter yang diperlukan; lengkapi laporan bonus dan uji rules di Firebase Emulator.
