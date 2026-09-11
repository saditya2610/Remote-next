# NexLink — Multi-Platform Remote Access

NexLink adalah aplikasi remote access berbasis WebRTC (P2P) dan Electron. Proyek ini awalnya dimulai sebagai prototype UI/UX dan telah dikembangkan untuk mendukung remote control sungguhan antara perangkat host dan klien.

## 🌟 Fitur Utama

*   **P2P Connection (WebRTC):** Koneksi langsung antar perangkat (Peer-to-Peer) dengan latensi rendah untuk LAN/WiFi, menggunakan STUN server.
*   **Desktop Capturer:** Mengambil layar PC secara real-time.
*   **Input Injection:** Meneruskan perintah *mouse* dan *keyboard* dari klien ke host tanpa delay.
*   **Multi-Client Ready:** Dirancang untuk mendukung akses dari PC/Laptop maupun Mobile/Touch.
*   **Premium UI/UX:** Desain *glassmorphism*, dark mode, dan performa tinggi.

---

## 🏗️ Arsitektur Sistem

Aplikasi ini memiliki 3 komponen utama:

1.  **Signaling Server (`server/signaling-server.js`)**: Server Node.js (WebSocket) yang bertugas mempertemukan Host dan Klien. Mengatur tukar-menukar Session Description Protocol (SDP) dan ICE Candidates untuk WebRTC.
2.  **Host App (PC yang dikontrol)**: Berjalan di Electron. Menangkap layar menggunakan `desktopCapturer`, mengirimkan video stream via WebRTC, dan menerima input dari klien untuk dieksekusi di OS (menggunakan script PowerShell native).
3.  **Client Viewer**: Berjalan di browser (atau window Electron lain). Menerima video stream, merender `<video>`, dan menangkap event mouse/keyboard lalu mengirimkannya via WebRTC DataChannel.

---

## 🚀 Cara Menjalankan (Development)

Pastikan **Node.js** v26+ sudah terinstall.

### 1. Install Dependencies
Buka terminal di dalam folder proyek ini, jalankan:
```bash
npm install
```

### 2. Jalankan Signaling Server
Buka tab terminal baru, jalankan server:
```bash
node server/signaling-server.js
```
*Server akan berjalan di port `3000`. Catat IP Local Area Network (LAN) yang ditampilkan di log.*

### 3. Jalankan Aplikasi NexLink (Electron)
Buka tab terminal baru, jalankan aplikasi Electron:
```bash
npm run dev
```

---

## 📦 Cara Build Aplikasi (.exe)

Aplikasi ini menggunakan `electron-builder`.

### Build Versi Portable (Single Executable)
```bash
npm run build
```
Hasil akan berada di folder `dist/NexLink-1.0.0-portable.exe`.

### Build Versi Installer (NSIS)
```bash
npm run build:installer
```
Hasil akan berada di folder `dist/NexLink-1.0.0-setup.exe`.

---

## 🎮 Cara Menggunakan (Remote Session)

**Di PC Host (yang ingin di-remote):**
1. Buka NexLink, klik **Host Dashboard**.
2. Masukkan alamat Signaling Server (contoh: `ws://localhost:3000` atau `ws://192.168.x.x:3000`).
3. Pilih monitor/layar yang ingin dibagikan, lalu klik **Mulai Berbagi Layar**.
4. Catat **ID Perangkat** dan **Password**.

**Di PC Client (yang digunakan untuk mengontrol):**
1. Buka NexLink (atau di PC lain dalam satu jaringan LAN).
2. Klik **Connect** di landing page.
3. Di layar klien, akan muncul popup. Masukkan:
   - Server URL: IP dari signaling server (harus sama dengan Host)
   - ID Perangkat Host
   - Password Host
4. Klik **Connect**. Layar Host akan muncul dan Anda bisa menggerakkan mouse serta mengetik.

---

## 📂 Struktur File Penting

*   `package.json` — Konfigurasi Node.js, dependencies, dan build scripts.
*   `app.js` — State dan helper global untuk UI.
*   `style.css` — Tema dan sistem desain.
*   **Electron Core:**
    *   `electron/main.js` — Proses utama Electron (IPC, manajemen window).
    *   `electron/preload.js` — Jembatan aman antara `main.js` dan UI.
    *   `electron/input-helper.ps1` — Script injeksi input Windows native.
*   **Signaling:**
    *   `server/signaling-server.js` — WebSockets room manager.
*   **Host Session:**
    *   `host.html` — UI Dashboard Host.
    *   `host-session.html` & `host-session.js` — Logic capture layar dan menanti koneksi.
*   **Client Session:**
    *   `client-desktop.html` — UI Viewer PC.
    *   `client-desktop-rtc.js` — Logic WebRTC menerima stream dan mengirim input.
    *   `client-mobile.html` — Prototype viewer UI untuk mobile touch.

---

*Catatan: Ini adalah proyek prototipe dan fungsional LAN. Penggunaan lintas jaringan internet memerlukan TURN server terpisah.*
