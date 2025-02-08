const express = require('express');
const fs = require('fs');
const path = require('path');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const PORT = process.env.PORT || 3000;

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
    const { username, password, school } = req.body;
    const dataFilePath = path.join(__dirname, 'data_user.txt');

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

        const userData = `${username},${password},${school}\n`;
        fs.appendFile(dataFilePath, userData, (err) => {
            if (err) return res.status(500).send('Server error');
            console.log(`User ${username} registered with school: ${school}`);
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
            const [_, __, school] = user.split(',');
            console.log('Login berhasil:', { username, school });
            res.json({ message: 'Login berhasil!', username, school });
        } else {
            res.status(401).json({ message: 'Username atau password salah!' });
        }
    });
});

// Create HTTP server and attach Socket.IO
const server = http.createServer(app);
const io = socketIo(server);

const activeUsers = new Set();
const chatLogPath = path.join(__dirname, 'chat.txt');

// Handle Socket.IO connections
io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    socket.on('join', (user) => {
        const { username, school } = user;
        if (!username || !school) {
            console.error('Invalid user data received:', user);
            return;
        }

        if (!activeUsers.has(username)) {
            socket.username = username;
            socket.school = school;
            activeUsers.add(username);
            io.emit('activeUsers', Array.from(activeUsers));
            const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const joinMessage = `${username} (${school}) has joined the chat.`;
            const logMessage = `[${timestamp}] [System] ${joinMessage}\n`;

            fs.appendFile(chatLogPath, logMessage, (err) => {
                if (err) console.error('Error writing to chat.txt:', err);
            });

            io.emit('message', { 
                username: 'System', 
                text: joinMessage,
                timestamp: timestamp 
            });
        }
    });

    socket.on('sendMessage', (message) => {
        const fullMessage = message.trim();
        if (!fullMessage) return;

        const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const formattedMessage = `${socket.username} (${socket.school}): ${fullMessage}`;
        const logMessage = `[${timestamp}] ${formattedMessage}\n`;

        fs.appendFile(chatLogPath, logMessage, (err) => {
            if (err) console.error('Error writing to chat.txt:', err);
        });

        io.emit('message', { 
            username: socket.username, 
            school: socket.school, 
            text: fullMessage,
            timestamp: timestamp 
        });
    });

    socket.on('disconnect', () => {
        console.log('A user disconnected:', socket.id);
        if (socket.username && activeUsers.has(socket.username)) {
            activeUsers.delete(socket.username);
            io.emit('activeUsers', Array.from(activeUsers));
            const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const leaveMessage = `${socket.username} (${socket.school}) has left the chat.`;
            const logMessage = `[${timestamp}] [System] ${leaveMessage}\n`;

            fs.appendFile(chatLogPath, logMessage, (err) => {
                if (err) console.error('Error writing to chat.txt:', err);
            });

            io.emit('message', { 
                username: 'System', 
                text: leaveMessage,
                timestamp: timestamp 
            });
        }
    });
});

// Start server (hanya jika dijalankan secara langsung, bukan di Vercel)
if (require.main === module) {
    server.listen(PORT, () => {
        console.log(`Server berjalan di http://localhost:${PORT}`);
    });
}

// Ekspor app untuk Vercel
module.exports = app;
