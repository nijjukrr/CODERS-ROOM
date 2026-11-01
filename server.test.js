const http = require('http');
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

    test('should include security headers and not disclose X-Powered-By header', (done) => {
        http.get(`http://localhost:${port}/`, (res) => {
            expect(res.headers['x-powered-by']).toBeUndefined();
            expect(res.headers['x-content-type-options']).toBe('nosniff');
            expect(res.headers['x-frame-options']).toBe('SAMEORIGIN');
            done();
        });
    });

    test('should reject overly large CODE_CHANGE payload', (done) => {
        const secondClient = ioClient(`http://localhost:${port}`, {
            'force new connection': true,
            transports: ['websocket'],
        });

        secondClient.on('connect', () => {
            clientSocket.emit(ACTIONS.JOIN, { roomId: 'test-room', username: 'user1' });
            secondClient.emit(ACTIONS.JOIN, { roomId: 'test-room', username: 'user2' });

            let receivedCodeChange = false;
            secondClient.on(ACTIONS.CODE_CHANGE, () => {
                receivedCodeChange = true;
            });

            // Send oversized code payload (> 1MB)
            clientSocket.emit(ACTIONS.CODE_CHANGE, {
                roomId: 'test-room',
                code: 'x'.repeat(1000001),
            });

            setTimeout(() => {
                expect(receivedCodeChange).toBe(false);
                secondClient.disconnect();
                done();
            }, 300);
        });
    });
});
