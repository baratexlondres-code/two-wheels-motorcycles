'use strict';

const { app, BrowserWindow, shell, ipcMain, dialog, Menu } = require('electron');
const path = require('path');

const WEB_APP_URL = 'https://twowheelsmotorcycles.lovable.app';
const MANUAL_URL = 'https://files.manuscdn.com/user_upload_by_module/session_file/310519663370733812/absAchFOUaCdFpAC.pdf';

let mainWindow = null;

// ─── FORCE QUIT HELPER ───────────────────────────────────────────────────────
// Called from every exit path — ensures the process always exits
function forceQuit() {
  if (mainWindow) {
    mainWindow.destroy(); // destroy() bypasses all close handlers
    mainWindow = null;
  }
  app.exit(0); // exit(0) is immediate, unlike quit() which can be cancelled
}

// ─── MENU ─────────────────────────────────────────────────────────────────────
function buildMenu() {
  const template = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Close App',
          accelerator: 'Alt+F4',
          click: () => forceQuit(),
        },
      ],
    },
    { role: 'editMenu' },
    { role: 'viewMenu' },
    { role: 'windowMenu' },
    {
      label: 'Help',
      submenu: [
        {
          label: 'Open in Browser',
          accelerator: 'CmdOrCtrl+Shift+B',
          click: () => shell.openExternal(WEB_APP_URL),
        },
        {
          label: 'User Manual',
          accelerator: 'F1',
          click: () => shell.openExternal(MANUAL_URL),
        },
        { type: 'separator' },
        {
          label: 'About Two Wheels Motorcycles',
          click: () => {
            if (mainWindow) {
              dialog.showMessageBox(mainWindow, {
                type: 'info',
                title: 'About',
                message: 'Two Wheels Motorcycles',
                detail: `Version ${app.getVersion()}\nMotorcycle Workshop Management System\n\n${WEB_APP_URL}`,
                buttons: ['OK'],
              });
            }
          },
        },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// ─── WINDOW ───────────────────────────────────────────────────────────────────
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    frame: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false,
      preload: path.join(__dirname, 'preload.cjs'),
    },
    title: 'Two Wheels Motorcycles',
    show: false,
    icon: path.join(__dirname, '../build/icon.png'),
  });

  mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    // Check for updates after a short delay so the window is fully shown first
    if (app.isPackaged) {
      setTimeout(() => checkForUpdates(), 3000);
    }
  });

  // Open external links in system browser
  mainWindow.webContents.setWindowOpenHandler(({ url: openUrl }) => {
    shell.openExternal(openUrl);
    return { action: 'deny' };
  });

  // When the window's X button is clicked — use forceQuit
  mainWindow.on('close', (e) => {
    e.preventDefault(); // prevent default so we can call forceQuit
    forceQuit();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// ─── AUTO UPDATER ─────────────────────────────────────────────────────────────
function checkForUpdates() {
  try {
    const { autoUpdater } = require('electron-updater');
    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = false; // NEVER block quit for install

    autoUpdater.on('update-available', (info) => {
      if (!mainWindow) return;
      dialog.showMessageBox(mainWindow, {
        type: 'info',
        title: 'Update Available',
        message: `Version ${info.version} is available. Download now?`,
        buttons: ['Download', 'Later'],
        defaultId: 0,
      }).then((result) => {
        if (result.response === 0) {
          autoUpdater.downloadUpdate();
          if (mainWindow) mainWindow.webContents.send('update-downloading');
        }
      }).catch(() => {});
    });

    autoUpdater.on('update-downloaded', () => {
      if (!mainWindow) return;
      dialog.showMessageBox(mainWindow, {
        type: 'info',
        title: 'Update Ready',
        message: 'Update downloaded. Restart to install?',
        buttons: ['Restart Now', 'Later'],
        defaultId: 0,
      }).then((result) => {
        if (result.response === 0) {
          autoUpdater.quitAndInstall(false, true);
        }
      }).catch(() => {});
    });

    autoUpdater.on('error', (err) => {
      console.error('Auto-updater error:', err.message);
    });

    autoUpdater.checkForUpdates().catch((err) => {
      console.error('checkForUpdates failed:', err.message);
    });
  } catch (e) {
    console.log('Auto-updater not available:', e.message);
  }
}

// ─── IPC ──────────────────────────────────────────────────────────────────────
// Close App button in sidebar
ipcMain.on('window-close', () => forceQuit());
ipcMain.on('window-minimize', () => { if (mainWindow) mainWindow.minimize(); });
ipcMain.on('window-maximize', () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) mainWindow.unmaximize();
    else mainWindow.maximize();
  }
});
ipcMain.on('open-external', (_, url) => shell.openExternal(url));
ipcMain.on('check-for-updates', () => { if (app.isPackaged) checkForUpdates(); });

// ─── APP LIFECYCLE ────────────────────────────────────────────────────────────
app.whenReady().then(() => {
  buildMenu();
  createWindow();
});

// Fallback: if all windows are closed by other means
app.on('window-all-closed', () => {
  app.exit(0);
});

app.on('activate', () => {
  if (mainWindow === null) createWindow();
});
