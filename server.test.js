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

    test('should allow valid CODE_CHANGE and forward to other clients in room', (done) => {
        const secondClient = ioClient(`http://localhost:${port}`, {
            'force new connection': true,
            transports: ['websocket'],
        });

        secondClient.on('connect', () => {
            clientSocket.emit(ACTIONS.JOIN, { roomId: 'code-room', username: 'user1' });
            secondClient.emit(ACTIONS.JOIN, { roomId: 'code-room', username: 'user2' });

            secondClient.on(ACTIONS.CODE_CHANGE, ({ code }) => {
                expect(code).toBe('console.log("hello world");');
                secondClient.disconnect();
                done();
            });

            setTimeout(() => {
                clientSocket.emit(ACTIONS.CODE_CHANGE, {
                    roomId: 'code-room',
                    code: 'console.log("hello world");',
                });
            }, 100);
        });
    });

    test('should ignore CODE_CHANGE payload with non-string or oversized code', (done) => {
        const secondClient = ioClient(`http://localhost:${port}`, {
            'force new connection': true,
            transports: ['websocket'],
        });

        secondClient.on('connect', () => {
            clientSocket.emit(ACTIONS.JOIN, { roomId: 'code-room-dos', username: 'user1' });
            secondClient.emit(ACTIONS.JOIN, { roomId: 'code-room-dos', username: 'user2' });

            let received = false;
            secondClient.on(ACTIONS.CODE_CHANGE, () => {
                received = true;
            });

            setTimeout(() => {
                // Non-string code
                clientSocket.emit(ACTIONS.CODE_CHANGE, {
                    roomId: 'code-room-dos',
                    code: { malicious: true },
                });
                // Oversized code (> 1e6 chars)
                clientSocket.emit(ACTIONS.CODE_CHANGE, {
                    roomId: 'code-room-dos',
                    code: 'x'.repeat(1000001),
                });
            }, 100);

            setTimeout(() => {
                expect(received).toBe(false);
                secondClient.disconnect();
                done();
            }, 400);
        });
    });

    test('should ignore SYNC_CODE with invalid socketId or oversized code', (done) => {
        let received = false;
        clientSocket.on(ACTIONS.CODE_CHANGE, () => {
            received = true;
        });

        // Invalid socketId type
        clientSocket.emit(ACTIONS.SYNC_CODE, {
            socketId: 12345,
            code: 'test',
        });

        // Oversized code
        clientSocket.emit(ACTIONS.SYNC_CODE, {
            socketId: clientSocket.id,
            code: 'x'.repeat(1000001),
        });

        setTimeout(() => {
            expect(received).toBe(false);
            done();
        }, 300);
    });
});
