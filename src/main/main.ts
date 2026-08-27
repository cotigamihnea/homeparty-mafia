import { app, BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';
import { startServer } from './server';

let mainWindow: BrowserWindow;

app.whenReady().then(async () => {
    // 1. Create the Desktop Window
    mainWindow = new BrowserWindow({
        width: 1280,
        height: 720,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false // Simplifies communication for local apps
        }
    });

    // 2. Start the Game Server
    const { ip, port } = await startServer() as any;

    // 3. Load the Host Screen UI into the window
    mainWindow.loadFile(path.join(__dirname, '../../src/renderer/index.html'));

    // 4. Send the IP and Port to the Host Screen so it can display it
    mainWindow.webContents.on('did-finish-load', () => {
        mainWindow.webContents.send('server-info', { ip, port });
    });
});