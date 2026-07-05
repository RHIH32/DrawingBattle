// npm init -y
// npm install express socket.io mongoose cors bcryptjs jsonwebtoken dotenv
require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.use(cors());
app.use(express.json());

// ================= BASIC ROUTE =================
// Yeh route 'Cannot GET /' wale error ko theek karega
app.get('/', (req, res) => {
    res.send('Art-Battle Multiplayer Server is Running! 🚀');
});

// ================= MONGODB SETUP =================
// Direct code mein database link (Sirf private use ke liye)
const MONGO_URI = "mongodb+srv://ravik884857_db_user:a1B2c3D4e5F6g7H8@cluster0.poitmy1.mongodb.net/chatbox?retryWrites=true&w=majority";

mongoose.connect(MONGO_URI)
    .then(() => console.log("✅ MongoDB Connected!"))
    .catch(err => console.log("DB Error:", err));

const UserSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    totalScore: { type: Number, default: 0 }
});
const User = mongoose.model('User', UserSchema);

// ================= API ROUTES (AUTH) =================
const JWT_SECRET = "ChatBox@2024_SuperSecretKey_abc123xyz789!";

app.post('/api/auth/register', async (req, res) => {
    try {
        const { username, email, password } = req.body;
        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = await User.create({ username, email, password: hashedPassword });
        const token = jwt.sign({ userId: newUser._id, username }, JWT_SECRET);
        res.json({ token, user: { username, score: 0 } });
    } catch (err) {
        res.status(400).json({ error: "Username or Email already exists!" });
    }
});

app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });
        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(400).json({ error: "Invalid Email or Password" });
        }
        const token = jwt.sign({ userId: user._id, username: user.username }, JWT_SECRET);
        res.json({ token, user: { username: user.username, score: user.totalScore } });
    } catch (err) {
        res.status(500).json({ error: "Server Error" });
    }
});

// ================= SOCKET.IO MULTIPLAYER =================
let onlinePlayers = {};

io.on('connection', (socket) => {
    console.log(`🔌 New Player Connected: ${socket.id}`);

    socket.on('user-join', (username) => {
        onlinePlayers[socket.id] = { username, score: 0 };
        io.emit('update-players', Object.values(onlinePlayers));
        socket.broadcast.emit('receive-message', { sender: "System", text: `${username} joined the lobby!`, isSystem: true });
    });

    // Drawing Sync
    socket.on('draw-line', (data) => {
        socket.broadcast.emit('draw-line', data);
    });

    socket.on('clear-canvas', () => {
        socket.broadcast.emit('clear-canvas');
    });

    // Chat Sync
    socket.on('send-message', (data) => {
        socket.broadcast.emit('receive-message', data);
    });

    socket.on('disconnect', () => {
        if(onlinePlayers[socket.id]) {
            const name = onlinePlayers[socket.id].username;
            delete onlinePlayers[socket.id];
            io.emit('update-players', Object.values(onlinePlayers));
            io.emit('receive-message', { sender: "System", text: `${name} left the game.`, isSystem: true });
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 Real Multiplayer Server running on port ${PORT}`);
});
