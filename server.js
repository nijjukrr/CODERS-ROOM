const express = require('express');
const app = express();
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');
const ACTIONS = require('./src/Actions');

const server = http.createServer(app);
const io = new Server(server);

// Security: Disable X-Powered-By to prevent framework fingerprinting
app.disable('x-powered-by');

// Security: Add fundamental HTTP security headers to protect against MIME sniffing and clickjacking
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    next();
});

app.use(express.static('build'));
app.use((req, res, next) => {
    res.sendFile(path.join(__dirname, 'build', 'index.html'));
});

const userSocketMap = {};
function getAllConnectedClients(roomId) {
    // Map
    return Array.from(io.sockets.adapter.rooms.get(roomId) || []).map(
        (socketId) => {
            return {
                socketId,
                username: userSocketMap[socketId],
            };
        }
    );
}

io.on('connection', (socket) => {
    console.log('socket connected', socket.id);

    socket.on(ACTIONS.JOIN, (payload) => {
        if (!payload || typeof payload !== 'object') return;
        const { roomId, username } = payload;
        // Security: Input validation to prevent socket event spoofing, DoS, or payload injection
        if (
            typeof roomId !== 'string' ||
            typeof username !== 'string' ||
            !roomId.trim() ||
            !username.trim() ||
            roomId.length > 50 ||
            username.length > 50
        ) {
            return;
        }

        userSocketMap[socket.id] = username;
        socket.join(roomId);
        const clients = getAllConnectedClients(roomId);
        clients.forEach(({ socketId }) => {
            io.to(socketId).emit(ACTIONS.JOINED, {
                clients,
                username,
                socketId: socket.id,
            });
        });
    });

    socket.on(ACTIONS.CODE_CHANGE, (payload) => {
        if (!payload || typeof payload !== 'object') return;
        const { roomId, code } = payload;
        // Security: Validate payload types and limit code length to prevent memory exhaustion / DoS
        if (typeof roomId !== 'string' || roomId.length > 50) return;
        if (code !== null && code !== undefined && (typeof code !== 'string' || code.length > 1e6)) return;
        socket.in(roomId).emit(ACTIONS.CODE_CHANGE, { code });
    });

    socket.on(ACTIONS.SYNC_CODE, (payload) => {
        if (!payload || typeof payload !== 'object') return;
        const { socketId, code } = payload;
        // Security: Validate recipient socketId and limit code payload
        if (typeof socketId !== 'string' || socketId.length > 50) return;
        if (code !== null && code !== undefined && (typeof code !== 'string' || code.length > 1e6)) return;
        io.to(socketId).emit(ACTIONS.CODE_CHANGE, { code });
    });

    socket.on('disconnecting', () => {
        const rooms = [...socket.rooms];
        rooms.forEach((roomId) => {
            socket.in(roomId).emit(ACTIONS.DISCONNECTED, {
                socketId: socket.id,
                username: userSocketMap[socket.id],
            });
        });
        delete userSocketMap[socket.id];
        socket.leave();
    });
});

const PORT = process.env.PORT || 5000;
if (process.env.NODE_ENV !== 'test') {
    server.listen(PORT, () => console.log(`Listening on port ${PORT}`));
}

module.exports = { app, server, io };
