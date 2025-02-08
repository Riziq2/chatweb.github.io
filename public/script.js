document.addEventListener('DOMContentLoaded', () => {
    const registerForm = document.getElementById('registerForm');
    const loginForm = document.getElementById('loginForm');
    const messageDiv = document.getElementById('message');

    // Fungsi untuk memeriksa apakah pengguna sudah login
    function checkLoginStatus() {
        const username = localStorage.getItem('username'); // Ambil username dari localStorage
        const school = localStorage.getItem('school'); // Ambil sekolah dari localStorage

        if (!username || !school) {
            alert('Anda harus login terlebih dahulu!');
            window.location.href = '/login'; // Redirect ke halaman login
            return false;
        }
        return true;
    }

    // Handle register form submission
    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = document.getElementById('username').value.trim(); // Hapus spasi
            const password = document.getElementById('password').value.trim(); // Hapus spasi
            const school = document.getElementById('school').value;

            if (!school) {
                alert('Anda harus memilih sekolah!');
                return;
            }

            const response = await fetch('/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password, school }), // Kirim data sekolah
            });

            const result = await response.json();
            if (response.ok) {
                alert(result.message);
                window.location.href = '/login'; // Redirect ke halaman login setelah registrasi
            } else {
                messageDiv.textContent = result.message;
                messageDiv.style.color = 'red';
            }
        });
    }

    // Handle login form submission
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = document.getElementById('username').value.trim(); // Hapus spasi
            const password = document.getElementById('password').value.trim(); // Hapus spasi

            const response = await fetch('/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password }),
            });

            const result = await response.json();
            if (response.ok) {
                localStorage.setItem('username', result.username); // Simpan username di localStorage
                localStorage.setItem('school', result.school); // Simpan sekolah di localStorage
                console.log('Login berhasil:', { username: result.username, school: result.school }); // Debugging
                window.location.href = '/chat'; // Redirect ke halaman chat
            } else {
                messageDiv.textContent = result.message;
                messageDiv.style.color = 'red';
            }
        });
    }

    // Chat functionality
    if (window.location.pathname === '/chat') {
        // Periksa status login
        if (!checkLoginStatus()) {
            return; // Jika pengguna belum login, hentikan eksekusi kode
        }

        const socket = io();
        const messagesDiv = document.getElementById('messages');
        const messageInput = document.getElementById('message-input');
        const sendButton = document.getElementById('send-button');

        const username = localStorage.getItem('username'); // Ambil username dari localStorage
        const school = localStorage.getItem('school'); // Ambil sekolah dari localStorage

        // Tampilkan nama pengguna dan sekolah di header
        document.getElementById('username').textContent = username;
        document.getElementById('school').textContent = school;

        // Notify server that the user has joined
        console.log('Sending join event with data:', { username, school }); // Debugging
        socket.emit('join', { username, school }); // Kirim username dan school ke server

        // Listen for incoming messages
        socket.on('message', (data) => {
            console.log('Pesan diterima:', data); // Debugging

            // Bersihkan pesan sebelum ditampilkan
            const cleanedText = data.text.trim();

            // Buat elemen bubble chat
            const messageElement = document.createElement('div');
            messageElement.classList.add('message');

            // Bedakan pesan pengguna dan orang lain
            if (data.username === username) {
                messageElement.classList.add('sent'); // Tambahkan kelas 'sent' untuk pengirim
                messageElement.innerHTML = `
                    <div class="username">${data.username} (${data.school})</div>
                    <div class="content sent">${cleanedText}</div>
                    <div class="timestamp">${data.timestamp}</div>
                `;
            } else if (data.username === 'System') {
                // Pesan sistem (bergabung/meninggalkan chat)
                messageElement.innerHTML = `
                    <div class="content system">${cleanedText}</div>
                `;
            } else {
                messageElement.classList.add('received'); // Tambahkan kelas 'received' untuk penerima
                messageElement.innerHTML = `
                    <div class="username">${data.username} (${data.school})</div>
                    <div class="content received">${cleanedText}</div>
                    <div class="timestamp">${data.timestamp}</div>
                `;
            }

            messagesDiv.appendChild(messageElement);
            messagesDiv.scrollTop = messagesDiv.scrollHeight; // Scroll ke bawah
        });

        // Send message on button click
        sendButton.addEventListener('click', () => {
            const message = messageInput.value.trim(); // Hapus spasi di awal dan akhir
            if (message) {
                socket.emit('sendMessage', message);
                messageInput.value = ''; // Kosongkan input setelah pesan dikirim
            }
        });

        // Send message on Enter key press
        messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                sendButton.click();
            }
        });

        // Listen for active users update
        socket.on('activeUsers', (users) => {
            console.log('Daftar pengguna aktif diperbarui:', users); // Debugging
            const activeUsersList = document.getElementById('user-list');
            const activeUsersCount = document.getElementById('active-user-count');

            activeUsersList.innerHTML = ''; // Kosongkan daftar pengguna aktif
            users.forEach(user => {
                const userElement = document.createElement('li');
                userElement.textContent = user; // Tambahkan nama pengguna ke daftar
                activeUsersList.appendChild(userElement);
            });

            activeUsersCount.textContent = `Jumlah Pengguna Aktif: ${users.length}`; // Perbarui jumlah pengguna aktif
        });
    }
});