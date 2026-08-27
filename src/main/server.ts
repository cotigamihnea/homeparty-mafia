import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { getLocalIPAddress } from './utils';
import { setupSockets } from './socket';
import * as path from 'path';

export function startServer() {
    const app = express();
    const httpServer = createServer(app);
    const io = new Server(httpServer, { cors: { origin: '*' } });

    setupSockets(io);

    // Serve the mobile UI to anyone who types the IP into their phone
    app.use(express.static(path.join(__dirname, '../../src/client')));

    // Start on port 0 (random port)
    return new Promise((resolve) => {
        const server = httpServer.listen(0, () => {
            const address = server.address();
            const port = typeof address === 'object' && address ? address.port : 8080;
            const ip = getLocalIPAddress();
            
            resolve({ ip, port, io });
        });
    });
}