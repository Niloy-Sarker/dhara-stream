const { app, BrowserWindow, session, ipcMain, dialog } = require('electron');
const fs = require('fs');
const path = require('path');

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
    icon: __dirname + '/icon.ico'
  });

  // Remove menu bar for smaller UI footprint
  mainWindow.setMenuBarVisibility(false);
  mainWindow.loadFile('index.html');

  // Handle IPC requests to update headers - essential for streaming
  ipcMain.on('set-headers', (event, { userAgent, cookie }) => {
    // Set new headers
    session.defaultSession.webRequest.onBeforeSendHeaders((details, callback) => {
      details.requestHeaders['User-Agent'] = userAgent;
      details.requestHeaders['Cookie'] = cookie;
      callback({ cancel: false, requestHeaders: details.requestHeaders });
    });

    event.reply('headers-set');
  });
  
  // Handle local file reading requests
  ipcMain.on('read-local-file', (event, { filePath }) => {
    try {
      // Resolve the path if it's not absolute
      const resolvedPath = path.isAbsolute(filePath) 
        ? filePath 
        : path.join(__dirname, filePath);
      
      const content = fs.readFileSync(resolvedPath, 'utf8');
      event.reply('local-file-content', { content });
    } catch (error) {
      event.reply('local-file-content', { error: error.message });
    }
  });

  // Handle open file dialog requests
  ipcMain.on('open-file-dialog', async (event) => {
    try {
      const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openFile'],
        filters: [
          { name: 'M3U Playlists', extensions: ['m3u', 'm3u8'] }
        ]
      });

      if (!result.canceled && result.filePaths.length > 0) {
        const filePath = result.filePaths[0];
        event.reply('file-selected', { filePath });
      }
    } catch (error) {
      event.reply('file-selected', { error: error.message });
    }
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});