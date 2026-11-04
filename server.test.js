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

    test('should ignore CODE_CHANGE payload with invalid or oversized code', (done) => {
        const receivedCodes = [];
        clientSocket.on(ACTIONS.CODE_CHANGE, ({ code }) => {
            receivedCodes.push(code);
        });

        clientSocket.emit(ACTIONS.JOIN, {
            roomId: 'room-code',
            username: 'testUser',
        });

        clientSocket.once(ACTIONS.JOINED, () => {
            // Invalid non-string code
            clientSocket.emit(ACTIONS.CODE_CHANGE, {
                roomId: 'room-code',
                code: { invalid: 'object' },
            });

            // Oversized code (> 1,000,000 characters)
            clientSocket.emit(ACTIONS.CODE_CHANGE, {
                roomId: 'room-code',
                code: 'x'.repeat(1000001),
            });

            // Invalid roomId
            clientSocket.emit(ACTIONS.CODE_CHANGE, {
                roomId: 12345,
                code: 'valid code',
            });

            setTimeout(() => {
                expect(receivedCodes).toHaveLength(0);
                done();
            }, 300);
        });
    });
});
