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

    test('should reject CODE_CHANGE from a client that has not joined the room', (done) => {
        const joinedClient = ioClient(`http://localhost:${port}`, {
            'force new connection': true,
            transports: ['websocket'],
        });

        joinedClient.on('connect', () => {
            joinedClient.emit(ACTIONS.JOIN, {
                roomId: 'room-secure',
                username: 'memberUser',
            });

            let receivedCodeChange = false;
            joinedClient.on(ACTIONS.CODE_CHANGE, () => {
                receivedCodeChange = true;
            });

            // clientSocket is NOT joined in room-secure
            clientSocket.emit(ACTIONS.CODE_CHANGE, {
                roomId: 'room-secure',
                code: 'console.log("unauthorized");',
            });

            setTimeout(() => {
                expect(receivedCodeChange).toBe(false);
                joinedClient.disconnect();
                done();
            }, 300);
        });
    });

    test('should reject CODE_CHANGE with invalid or oversized payload', (done) => {
        clientSocket.emit(ACTIONS.JOIN, {
            roomId: 'room-valid',
            username: 'validUser',
        });

        const secondClient = ioClient(`http://localhost:${port}`, {
            'force new connection': true,
            transports: ['websocket'],
        });

        secondClient.on('connect', () => {
            secondClient.emit(ACTIONS.JOIN, {
                roomId: 'room-valid',
                username: 'secondUser',
            });

            let codeChangeReceived = false;
            secondClient.on(ACTIONS.CODE_CHANGE, () => {
                codeChangeReceived = true;
            });

            // Non-string payload
            clientSocket.emit(ACTIONS.CODE_CHANGE, {
                roomId: 'room-valid',
                code: 12345,
            });

            // Oversized payload (> 100,000 chars)
            clientSocket.emit(ACTIONS.CODE_CHANGE, {
                roomId: 'room-valid',
                code: 'x'.repeat(100001),
            });

            setTimeout(() => {
                expect(codeChangeReceived).toBe(false);
                secondClient.disconnect();
                done();
            }, 300);
        });
    });
});
