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

    test('should ignore CODE_CHANGE payload if sender has not joined the room', (done) => {
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

        // clientSocket (not joined to 'room-code-test') tries to emit CODE_CHANGE
        setTimeout(() => {
            clientSocket.emit(ACTIONS.CODE_CHANGE, {
                roomId: 'room-code-test',
                code: 'console.log("hacked")',
            });
        }, 100);

        setTimeout(() => {
            expect(codeChangeReceived).toBe(false);
            clientSocket2.disconnect();
            done();
        }, 400);
    });

    test('should broadcast CODE_CHANGE if sender has joined the room and payload is valid', (done) => {
        const clientSocket2 = ioClient(`http://localhost:${port}`, {
            'force new connection': true,
            transports: ['websocket'],
        });

        clientSocket.emit(ACTIONS.JOIN, {
            roomId: 'room-valid-code',
            username: 'senderUser',
        });

        clientSocket2.on('connect', () => {
            clientSocket2.emit(ACTIONS.JOIN, {
                roomId: 'room-valid-code',
                username: 'listenerUser',
            });
        });

        clientSocket2.on(ACTIONS.CODE_CHANGE, (data) => {
            expect(data.code).toBe('const x = 42;');
            clientSocket2.disconnect();
            done();
        });

        setTimeout(() => {
            clientSocket.emit(ACTIONS.CODE_CHANGE, {
                roomId: 'room-valid-code',
                code: 'const x = 42;',
            });
        }, 200);
    });

    test('should ignore CODE_CHANGE payload if code is not a string or exceeds max length', (done) => {
        const clientSocket2 = ioClient(`http://localhost:${port}`, {
            'force new connection': true,
            transports: ['websocket'],
        });

        clientSocket.emit(ACTIONS.JOIN, {
            roomId: 'room-invalid-code',
            username: 'senderUser',
        });

        clientSocket2.on('connect', () => {
            clientSocket2.emit(ACTIONS.JOIN, {
                roomId: 'room-invalid-code',
                username: 'listenerUser',
            });
        });

        let codeChangeReceived = false;
        clientSocket2.on(ACTIONS.CODE_CHANGE, () => {
            codeChangeReceived = true;
        });

        setTimeout(() => {
            // Non-string code
            clientSocket.emit(ACTIONS.CODE_CHANGE, {
                roomId: 'room-invalid-code',
                code: { malicious: 'object' },
            });
        }, 100);

        setTimeout(() => {
            expect(codeChangeReceived).toBe(false);
            clientSocket2.disconnect();
            done();
        }, 400);
    });
});
