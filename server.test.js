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

    test('should prevent CODE_CHANGE from a socket that has not joined the room', (done) => {
        const clientSocket2 = ioClient(`http://localhost:${port}`, {
            'force new connection': true,
            transports: ['websocket'],
        });

        clientSocket2.on('connect', () => {
            // clientSocket2 joins room-test
            clientSocket2.emit(ACTIONS.JOIN, {
                roomId: 'room-test',
                username: 'listener',
            });

            clientSocket2.on(ACTIONS.JOINED, () => {
                let codeChangeReceived = false;
                clientSocket2.on(ACTIONS.CODE_CHANGE, () => {
                    codeChangeReceived = true;
                });

                // clientSocket (not joined to room-test) attempts to emit CODE_CHANGE to room-test
                clientSocket.emit(ACTIONS.CODE_CHANGE, {
                    roomId: 'room-test',
                    code: 'console.log("unauthorized injection");',
                });

                setTimeout(() => {
                    expect(codeChangeReceived).toBe(false);
                    clientSocket2.disconnect();
                    done();
                }, 300);
            });
        });
    });

    test('should allow CODE_CHANGE from an authorized member in the room', (done) => {
        const clientSocket2 = ioClient(`http://localhost:${port}`, {
            'force new connection': true,
            transports: ['websocket'],
        });

        clientSocket.emit(ACTIONS.JOIN, {
            roomId: 'room-auth',
            username: 'sender',
        });

        clientSocket.on(ACTIONS.JOINED, () => {
            clientSocket2.on('connect', () => {
                clientSocket2.emit(ACTIONS.JOIN, {
                    roomId: 'room-auth',
                    username: 'receiver',
                });

                clientSocket2.on(ACTIONS.CODE_CHANGE, (data) => {
                    expect(data.code).toBe('const x = 42;');
                    clientSocket2.disconnect();
                    done();
                });

                clientSocket2.on(ACTIONS.JOINED, () => {
                    clientSocket.emit(ACTIONS.CODE_CHANGE, {
                        roomId: 'room-auth',
                        code: 'const x = 42;',
                    });
                });
            });
        });
    });

    test('should reject SYNC_CODE targeting a socket in a different room', (done) => {
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

            let syncReceived = false;
            clientSocket2.on(ACTIONS.CODE_CHANGE, () => {
                syncReceived = true;
            });

            setTimeout(() => {
                // clientSocket attempts to sync to clientSocket2 across rooms
                clientSocket.emit(ACTIONS.SYNC_CODE, {
                    socketId: clientSocket2.id,
                    code: 'malicious payload',
                });

                setTimeout(() => {
                    expect(syncReceived).toBe(false);
                    clientSocket2.disconnect();
                    done();
                }, 300);
            }, 100);
        });
    });
});
