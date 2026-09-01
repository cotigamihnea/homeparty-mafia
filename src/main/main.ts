import { app, BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';
import { startServer } from './server';

let mainWindow: BrowserWindow;

app.whenReady().then(async () => {
    mainWindow = new BrowserWindow({
        width: 1920,
        height: 1080,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    const { ip, port } = await startServer() as any;

    mainWindow.loadFile(path.join(__dirname, '../../src/renderer/index.html'));

    mainWindow.webContents.on('did-finish-load', () => {
        mainWindow.webContents.send('server-info', { ip, port });
    });
});