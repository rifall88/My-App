**My App API**

My App API adalah RESTful API yang digunakan untuk mendukung aplikasi penyewaan peralatan. API ini berfungsi sebagai penghubung antara frontend dan database sehingga pengguna dapat melakukan berbagai aktivitas seperti registrasi, login, melihat daftar peralatan yang tersedia, menambahkan peralatan ke keranjang, serta melakukan proses penyewaan. Selain itu, API ini juga menyediakan sistem autentikasi menggunakan token (JWT) agar setiap permintaan dari pengguna dapat diverifikasi keamanannya. Dengan adanya My App API, seluruh proses pengelolaan data seperti pengguna, peralatan, dan transaksi penyewaan dapat dilakukan secara terstruktur dan efisien melalui komunikasi antara client dan server.

**Cara Menjalankan Project**

1. Clone repository ini.
2. Masuk ke folder project, lalu jalankan perintah npm install
   (pastikan Node.js dan npm sudah terpasang).
3. Buat file .env di root project.
4. Lakukan migrasi database dengan cara jalankan:
   ```bash
   npx prisma generate
   npx prisma migrate dev
   ```
5. Masuk ke folder prisma lalu jalankan "node createAdmin" untuk
   membuat user dengan role Admin
6. Jalankan project dengan perintah npm start.

**Isi .env**

```env
DATABASE_URL=""
PORT=
JWT_SECRET=""
ADMIN_PASSWORD=""
SMTP_HOST=
SMTP_PORT=
SMTP_FROM=""
SMTP_USER=
SMTP_PASS=
```

Jika ingin akses swaggernya langsung bisa klik link di bawah ini 👇👇👇

[Link Swagger](https://apimyapp.projectbase.my.id/swagger/)
