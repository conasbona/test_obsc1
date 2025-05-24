// Electron Main Process for Obscura GUI IPC Integration
// Electron Main Process for Obscura GUI IPC Integration
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs/promises');

const CONFIG_PATH = path.resolve(__dirname, '../config/config.json');
console.log('[GUI] Using CONFIG_PATH:', CONFIG_PATH);

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js') // To be created for IPC security
    }
  });
  mainWindow.loadFile('index.html'); // Placeholder, can be updated later
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// IPC: Get the entire config
ipcMain.handle('get-protection-config', async () => {
  try {
    const raw = await fs.readFile(CONFIG_PATH, 'utf-8');
    const config = JSON.parse(raw);
    return config;
  } catch (err) {
    console.error('[IPC] Error getting config:', err);
    throw err;
  }
});

// IPC: Set the entire config (or just toggles)
ipcMain.handle('set-protection-config', async (event, newConfig) => {
  try {
    const raw = await fs.readFile(CONFIG_PATH, 'utf-8');
    const config = JSON.parse(raw);
    config.protectionToggles = { ...config.protectionToggles, ...newConfig.protectionToggles };
    await fs.writeFile(CONFIG_PATH, JSON.stringify(config, null, 2));
    return config;
  } catch (err) {
    console.error('[IPC] Error setting config:', err);
    throw err;
  }
});

// IPC: Reload protections (no-op if backend watches config)
ipcMain.handle('reload-protections', async () => {
  // Optionally, emit an event or perform extra logic here
  return true;
});
