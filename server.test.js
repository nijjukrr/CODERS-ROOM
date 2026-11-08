const ioClient = require('socket.io-client');
const { server } = require('./server');
const ACTIONS = require('./src/Actions');

describe('Server Socket Event Security Validation', () => {
    let clientSocket;
    let port;

    beforeAll((done) => {
        server.listen(0, () => {
            port = server.address().port;
            done();
        });
    });

    afterAll((done) => {
        server.close(done);
    });

    beforeEach((done) => {
        clientSocket = ioClient(`http://localhost:${port}`, {
            'force new connection': true,
            transports: ['websocket'],
        });
        clientSocket.on('connect', done);
    });

    afterEach(() => {
        if (clientSocket.connected) {
            clientSocket.disconnect();
        }
    });

    test('should allow valid JOIN payload', (done) => {
        clientSocket.on(ACTIONS.JOINED, (data) => {
            expect(data.username).toBe('testUser');
            expect(data.clients).toHaveLength(1);
            done();
        });

        clientSocket.emit(ACTIONS.JOIN, {
            roomId: 'room-123',
            username: 'testUser',
        });
    });

    test('should ignore JOIN payload with non-string roomId or username', (done) => {
        let eventReceived = false;
        clientSocket.on(ACTIONS.JOINED, () => {
            eventReceived = true;
        });

        clientSocket.emit(ACTIONS.JOIN, {
            roomId: 12345,
            username: 'testUser',
        });

        setTimeout(() => {
            expect(eventReceived).toBe(false);
            done();
        }, 300);
    });

    test('should ignore JOIN payload with overly long username or roomId', (done) => {
        let eventReceived = false;
        clientSocket.on(ACTIONS.JOINED, () => {
            eventReceived = true;
        });

        clientSocket.emit(ACTIONS.JOIN, {
            roomId: 'room-123',
            username: 'a'.repeat(51),
        });

        setTimeout(() => {
            expect(eventReceived).toBe(false);
            done();
        }, 300);
    });

    test('should ignore CODE_CHANGE if sender is not joined to the room', (done) => {
        const clientSocket2 = ioClient(`http://localhost:${port}`, {
            'force new connection': true,
            transports: ['websocket'],
        });

        clientSocket2.on('connect', () => {
            clientSocket2.emit(ACTIONS.JOIN, {
                roomId: 'room-code-test',
                username: 'listenerUser',
            });
        });

        let codeChangeReceived = false;
        clientSocket2.on(ACTIONS.CODE_CHANGE, () => {
            codeChangeReceived = true;
        });

        // clientSocket (not joined to 'room-code-test') tries to emit CODE_CHANGE to 'room-code-test'
        clientSocket.emit(ACTIONS.CODE_CHANGE, {
            roomId: 'room-code-test',
            code: 'console.log("unauthorized injection");',
        });

        setTimeout(() => {
            expect(codeChangeReceived).toBe(false);
            clientSocket2.disconnect();
            done();
        }, 300);
    });

    test('should ignore CODE_CHANGE if code payload is invalid or exceeds length limit', (done) => {
        const clientSocket2 = ioClient(`http://localhost:${port}`, {
            'force new connection': true,
            transports: ['websocket'],
        });

        clientSocket.emit(ACTIONS.JOIN, {
            roomId: 'room-limit-test',
            username: 'user1',
        });

        clientSocket2.on('connect', () => {
            clientSocket2.emit(ACTIONS.JOIN, {
                roomId: 'room-limit-test',
                username: 'user2',
            });
        });

        let codeChangeReceived = false;
        clientSocket2.on(ACTIONS.CODE_CHANGE, () => {
            codeChangeReceived = true;
        });

        // Emit non-string or oversized code
        clientSocket.emit(ACTIONS.CODE_CHANGE, {
            roomId: 'room-limit-test',
            code: { script: 'bad object' },
        });

        setTimeout(() => {
            expect(codeChangeReceived).toBe(false);
            clientSocket2.disconnect();
            done();
        }, 300);
    });

    test('should broadcast CODE_CHANGE to other room members when authorized and valid', (done) => {
        const clientSocket2 = ioClient(`http://localhost:${port}`, {
            'force new connection': true,
            transports: ['websocket'],
        });

        clientSocket.emit(ACTIONS.JOIN, {
            roomId: 'room-broadcast-test',
            username: 'senderUser',
        });

        clientSocket2.on('connect', () => {
            clientSocket2.emit(ACTIONS.JOIN, {
                roomId: 'room-broadcast-test',
                username: 'receiverUser',
            });
        });

        clientSocket2.on(ACTIONS.CODE_CHANGE, ({ code }) => {
            expect(code).toBe('const x = 42;');
            clientSocket2.disconnect();
            done();
        });

        // Wait slightly for both to join room, then emit valid CODE_CHANGE
        setTimeout(() => {
            clientSocket.emit(ACTIONS.CODE_CHANGE, {
                roomId: 'room-broadcast-test',
                code: 'const x = 42;',
            });
        }, 100);
    });
});
