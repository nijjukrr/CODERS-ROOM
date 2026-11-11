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

    test('should not broadcast CODE_CHANGE if socket is not a member of the room', (done) => {
        const clientSocket2 = ioClient(`http://localhost:${port}`, {
            'force new connection': true,
            transports: ['websocket'],
        });

        clientSocket2.on('connect', () => {
            clientSocket2.emit(ACTIONS.JOIN, {
                roomId: 'target-room',
                username: 'victim',
            });

            let changeReceived = false;
            clientSocket2.on(ACTIONS.CODE_CHANGE, () => {
                changeReceived = true;
            });

            // clientSocket has NOT joined target-room
            clientSocket.emit(ACTIONS.CODE_CHANGE, {
                roomId: 'target-room',
                code: 'malicious_code()',
            });

            setTimeout(() => {
                expect(changeReceived).toBe(false);
                clientSocket2.disconnect();
                done();
            }, 300);
        });
    });

    test('should broadcast CODE_CHANGE if socket is authorized and in the room', (done) => {
        const clientSocket2 = ioClient(`http://localhost:${port}`, {
            'force new connection': true,
            transports: ['websocket'],
        });

        clientSocket2.on('connect', () => {
            clientSocket2.emit(ACTIONS.JOIN, {
                roomId: 'shared-room',
                username: 'listener',
            });

            clientSocket.emit(ACTIONS.JOIN, {
                roomId: 'shared-room',
                username: 'sender',
            });

            clientSocket2.on(ACTIONS.CODE_CHANGE, ({ code }) => {
                expect(code).toBe('const x = 42;');
                clientSocket2.disconnect();
                done();
            });

            setTimeout(() => {
                clientSocket.emit(ACTIONS.CODE_CHANGE, {
                    roomId: 'shared-room',
                    code: 'const x = 42;',
                });
            }, 100);
        });
    });

    test('should ignore CODE_CHANGE payload with non-string or oversized code', (done) => {
        const clientSocket2 = ioClient(`http://localhost:${port}`, {
            'force new connection': true,
            transports: ['websocket'],
        });

        clientSocket2.on('connect', () => {
            clientSocket2.emit(ACTIONS.JOIN, {
                roomId: 'valid-room',
                username: 'user2',
            });

            clientSocket.emit(ACTIONS.JOIN, {
                roomId: 'valid-room',
                username: 'user1',
            });

            let changeReceived = false;
            clientSocket2.on(ACTIONS.CODE_CHANGE, () => {
                changeReceived = true;
            });

            setTimeout(() => {
                // Non-string code
                clientSocket.emit(ACTIONS.CODE_CHANGE, {
                    roomId: 'valid-room',
                    code: { evil: true },
                });
            }, 100);

            setTimeout(() => {
                expect(changeReceived).toBe(false);
                clientSocket2.disconnect();
                done();
            }, 300);
        });
    });
});
