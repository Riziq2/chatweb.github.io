const express = require('express');
const fs = require('fs');
const path = require('path');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const PORT = 3000;

// Middleware untuk parsing JSON
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files (CSS, JS)
app.use(express.static(path.join(__dirname, 'public')));

// Routes for serving HTML pages
app.get('/register', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'register.html'));
});

app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'login.html'));
});

app.get('/chat', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'chat.html'));
});

// Register endpoint
app.post('/register', (req, res) => {
    const { username, password, school } = req.body; // Tambahkan field "school"
    const dataFilePath = path.join(__dirname, 'data_user.txt');

    // Validasi pilihan sekolah
    const validSchools = ['SMP IT', 'MTsN 3', 'SMP N 1'];
    if (!validSchools.includes(school)) {
        return res.status(400).json({ message: 'Pilihan sekolah tidak valid!' });
    }

    fs.readFile(dataFilePath, 'utf8', (err, data) => {
        if (err && err.code !== 'ENOENT') return res.status(500).send('Server error');

        const users = (data || '').split('\n').filter(line => line.trim() !== '');
        const isUsernameExists = users.some(line => line.split(',')[0] === username);

        if (isUsernameExists) {
            return res.status(400).json({ message: 'Username sudah digunakan!' });
        }

        // Simpan username, password, dan sekolah ke file dalam format CSV
        const userData = `${username},${password},${school}\n`;
        fs.appendFile(dataFilePath, userData, (err) => {
            if (err) return res.status(500).send('Server error');
            console.log(`User ${username} registered with school: ${school}`); // Debugging
            res.json({ message: 'Registrasi berhasil! Silakan login.' });
        });
    });
});

// Login endpoint
app.post('/login', (req, res) => {
    const { username, password } = req.body;
    const dataFilePath = path.join(__dirname, 'data_user.txt');

    fs.readFile(dataFilePath, 'utf8', (err, data) => {
        if (err && err.code !== 'ENOENT') return res.status(500).send('Server error');

        const users = (data || '').split('\n').filter(line => line.trim() !== '');
        const user = users.find(line => {
            const [storedUsername, storedPassword, school] = line.split(',');
            return storedUsername === username && storedPassword === password;
        });

        if (user) {
            const [_, __, school] = user.split(','); // Ambil data sekolah
            console.log('Login berhasil:', { username, school }); // Debugging
            res.json({ message: 'Login berhasil!', username, school }); // Kirim data sekolah
        } else {
            res.status(401).json({ message: 'Username atau password salah!' });
        }
    });
});

// Create HTTP server and attach Socket.IO
const server = http.createServer(app);
const io = socketIo(server);

// Store active users
const activeUsers = new Set();

// Path to the chat log file
const chatLogPath = path.join(__dirname, 'chat.txt');

// Handle Socket.IO connections
io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    // Listen for user joining the chat
    socket.on('join', (user) => {
        const { username, school } = user; // Ekstrak username dan school dari objek
        if (!username || !school) {
            console.error('Invalid user data received:', user);
            return;
        }

        if (!activeUsers.has(username)) {
            socket.username = username;
            socket.school = school; // Simpan sekolah di socket
            activeUsers.add(username);
            io.emit('activeUsers', Array.from(activeUsers)); // Kirim daftar pengguna aktif ke semua klien
            const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const joinMessage = `${username} (${school}) has joined the chat.`; // Tambahkan sekolah ke pesan
            const logMessage = `[${timestamp}] [System] ${joinMessage}\n`;

            // Simpan pesan sistem ke chat.txt
            fs.appendFile(chatLogPath, logMessage, (err) => {
                if (err) console.error('Error writing to chat.txt:', err);
            });

            io.emit('message', { 
                username: 'System', 
                text: joinMessage,
                timestamp: timestamp // Kirim timestamp ke frontend
            });
        }
    });

    // Listen for new messages
    socket.on('sendMessage', (message) => {
        const fullMessage = message.trim(); // Hapus spasi di awal dan akhir
        if (!fullMessage) return; // Jangan kirim pesan kosong

        const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const formattedMessage = `${socket.username} (${socket.school}): ${fullMessage}`;
        const logMessage = `[${timestamp}] ${formattedMessage}\n`;

        // Simpan pesan ke chat.txt dengan timestamp
        fs.appendFile(chatLogPath, logMessage, (err) => {
            if (err) console.error('Error writing to chat.txt:', err);
        });

        io.emit('message', { 
            username: socket.username, 
            school: socket.school, 
            text: fullMessage,
            timestamp: timestamp // Kirim timestamp ke frontend
        });
    });

    // Handle user disconnect
    socket.on('disconnect', () => {
        console.log('A user disconnected:', socket.id);
        if (socket.username && activeUsers.has(socket.username)) {
            activeUsers.delete(socket.username);
            io.emit('activeUsers', Array.from(activeUsers)); // Kirim daftar pengguna aktif ke semua klien
            const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const leaveMessage = `${socket.username} (${socket.school}) has left the chat.`; // Tambahkan sekolah ke pesan
            const logMessage = `[${timestamp}] [System] ${leaveMessage}\n`;

            // Simpan pesan sistem ke chat.txt
            fs.appendFile(chatLogPath, logMessage, (err) => {
                if (err) console.error('Error writing to chat.txt:', err);
            });

            io.emit('message', { 
                username: 'System', 
                text: leaveMessage,
                timestamp: timestamp // Kirim timestamp ke frontend
            });
        }
    });
});

// Start server
server.listen(PORT, () => {
    console.log(`Server berjalan di http://localhost:${PORT}`);
});