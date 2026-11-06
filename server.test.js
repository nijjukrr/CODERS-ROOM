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

    test('should prevent broadcasting CODE_CHANGE if socket is not in the room', (done) => {
        const clientSocket2 = ioClient(`http://localhost:${port}`, {
            'force new connection': true,
            transports: ['websocket'],
        });

        clientSocket2.on('connect', () => {
            clientSocket2.emit(ACTIONS.JOIN, {
                roomId: 'target-room',
                username: 'roomUser',
            });
        });

        let codeChanged = false;
        clientSocket2.on(ACTIONS.CODE_CHANGE, () => {
            codeChanged = true;
        });

        // clientSocket is NOT in 'target-room'
        clientSocket.emit(ACTIONS.CODE_CHANGE, {
            roomId: 'target-room',
            code: 'console.log("hacked")',
        });

        setTimeout(() => {
            clientSocket2.disconnect();
            expect(codeChanged).toBe(false);
            done();
        }, 300);
    });

    test('should prevent SYNC_CODE targeting socket in a different room', (done) => {
        const clientSocket2 = ioClient(`http://localhost:${port}`, {
            'force new connection': true,
            transports: ['websocket'],
        });

        clientSocket.emit(ACTIONS.JOIN, {
            roomId: 'room-A',
            username: 'userA',
        });

        clientSocket2.on('connect', () => {
            clientSocket2.emit(ACTIONS.JOIN, {
                roomId: 'room-B',
                username: 'userB',
            });
        });

        let codeSynced = false;
        clientSocket2.on(ACTIONS.CODE_CHANGE, () => {
            codeSynced = true;
        });

        setTimeout(() => {
            // clientSocket in room-A attempts to send code to clientSocket2 in room-B
            clientSocket.emit(ACTIONS.SYNC_CODE, {
                socketId: clientSocket2.id,
                code: 'maliciousSync()',
            });

            setTimeout(() => {
                clientSocket2.disconnect();
                expect(codeSynced).toBe(false);
                done();
            }, 300);
        }, 100);
    });

    test('should allow SYNC_CODE and CODE_CHANGE between sockets in the same room', (done) => {
        const clientSocket2 = ioClient(`http://localhost:${port}`, {
            'force new connection': true,
            transports: ['websocket'],
        });

        clientSocket.emit(ACTIONS.JOIN, {
            roomId: 'room-shared',
            username: 'user1',
        });

        clientSocket2.on('connect', () => {
            clientSocket2.emit(ACTIONS.JOIN, {
                roomId: 'room-shared',
                username: 'user2',
            });
        });

        let codeReceivedCount = 0;
        clientSocket2.on(ACTIONS.CODE_CHANGE, ({ code }) => {
            if (code === 'sharedCode()') {
                codeReceivedCount++;
            }
        });

        setTimeout(() => {
            // Authorized CODE_CHANGE in room-shared
            clientSocket.emit(ACTIONS.CODE_CHANGE, {
                roomId: 'room-shared',
                code: 'sharedCode()',
            });

            setTimeout(() => {
                clientSocket2.disconnect();
                expect(codeReceivedCount).toBe(1);
                done();
            }, 300);
        }, 100);
    });
});
