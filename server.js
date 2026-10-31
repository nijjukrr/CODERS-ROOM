const express = require('express');
const app = express();
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');
const ACTIONS = require('./src/Actions');

const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('build'));
app.use((req, res, next) => {
    res.sendFile(path.join(__dirname, 'build', 'index.html'));
});

// Security: Limit code buffer size to 1MB to prevent socket payload abuse and DoS
const MAX_CODE_LENGTH = 1e6;

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
        // Security: Validate roomId and code payload to mitigate DoS, memory bloat, and invalid data injection
        if (typeof roomId !== 'string' || roomId.length > 50) return;
        if (typeof code !== 'string' || code.length > MAX_CODE_LENGTH) return;
        socket.in(roomId).emit(ACTIONS.CODE_CHANGE, { code });
    });

    socket.on(ACTIONS.SYNC_CODE, (payload) => {
        if (!payload || typeof payload !== 'object') return;
        const { socketId, code } = payload;
        // Security: Validate socket target and code payload type and length bounds
        if (typeof socketId !== 'string' || socketId.length > 50) return;
        if (code !== null && code !== undefined && (typeof code !== 'string' || code.length > MAX_CODE_LENGTH)) return;
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
