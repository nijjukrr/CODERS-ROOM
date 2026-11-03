const http = require('http');
const ioClient = require('socket.io-client');
const { server } = require('./server');
const ACTIONS = require('./src/Actions');

describe('Server HTTP Security Headers', () => {
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

    test('should include defensive security headers and hide x-powered-by', (done) => {
        http.get(`http://localhost:${port}`, (res) => {
            expect(res.headers['x-powered-by']).toBeUndefined();
            expect(res.headers['x-content-type-options']).toBe('nosniff');
            expect(res.headers['x-frame-options']).toBe('SAMEORIGIN');
            expect(res.headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
            done();
        });
    });
});

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

    test('should ignore CODE_CHANGE payload with overly long code or non-string code', (done) => {
        let client2 = ioClient(`http://localhost:${port}`, {
            'force new connection': true,
            transports: ['websocket'],
        });

        client2.on('connect', () => {
            client2.emit(ACTIONS.JOIN, {
                roomId: 'room-code-test',
                username: 'listenerUser',
            });
        });

        clientSocket.emit(ACTIONS.JOIN, {
            roomId: 'room-code-test',
            username: 'senderUser',
        });

        let codeChanged = false;
        client2.on(ACTIONS.CODE_CHANGE, () => {
            codeChanged = true;
        });

        // Send invalid code payload (exceeding limit)
        setTimeout(() => {
            clientSocket.emit(ACTIONS.CODE_CHANGE, {
                roomId: 'room-code-test',
                code: 'x'.repeat(1e6 + 1),
            });
        }, 100);

        setTimeout(() => {
            expect(codeChanged).toBe(false);
            client2.disconnect();
            done();
        }, 400);
    });
});
