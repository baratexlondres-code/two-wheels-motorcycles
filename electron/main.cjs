const { app, BrowserWindow, shell, ipcMain, dialog, Menu } = require('electron');
const path = require('path');

const WEB_APP_URL = 'https://twowheelsmotorcycles.lovable.app';
const MANUAL_URL = 'https://files.manuscdn.com/user_upload_by_module/session_file/310519663370733812/absAchFOUaCdFpAC.pdf';

let mainWindow;

function buildMenu() {
  const template = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Close App',
          accelerator: 'Alt+F4',
          click: () => { app.quit(); },
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
          click: () => { shell.openExternal(WEB_APP_URL); },
        },
        {
          label: 'User Manual',
          accelerator: 'F1',
          click: () => { shell.openExternal(MANUAL_URL); },
        },
        { type: 'separator' },
        {
          label: 'About Two Wheels Motorcycles',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'About',
              message: 'Two Wheels Motorcycles',
              detail: `Version ${app.getVersion()}\nMotorcycle Workshop Management System\n\nhttps://twowheelsmotorcycles.lovable.app`,
              buttons: ['OK'],
            });
          },
        },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

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
    if (app.isPackaged) {
      checkForUpdates();
    }
  });

  // Open external links in system browser
  mainWindow.webContents.setWindowOpenHandler(({ url: openUrl }) => {
    shell.openExternal(openUrl);
    return { action: 'deny' };
  });

  // Do NOT intercept the close event — let it close naturally
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function checkForUpdates() {
  try {
    const { autoUpdater } = require('electron-updater');
    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = true;
    autoUpdater.on('update-available', (info) => {
      dialog.showMessageBox(mainWindow, {
        type: 'info',
        title: 'Update Available',
        message: `Version ${info.version} is available. Would you like to download it now?`,
        buttons: ['Download', 'Later'],
        defaultId: 0,
      }).then((result) => {
        if (result.response === 0) {
          autoUpdater.downloadUpdate();
          if (mainWindow) mainWindow.webContents.send('update-downloading');
        }
      });
    });
    autoUpdater.on('update-downloaded', () => {
      dialog.showMessageBox(mainWindow, {
        type: 'info',
        title: 'Update Ready',
        message: 'Update downloaded. The app will restart to install the update.',
        buttons: ['Restart Now', 'Later'],
        defaultId: 0,
      }).then((result) => {
        if (result.response === 0) autoUpdater.quitAndInstall();
      });
    });
    autoUpdater.on('error', (err) => { console.error('Auto-updater error:', err); });
    autoUpdater.checkForUpdates();
  } catch (e) {
    console.log('Auto-updater not available:', e.message);
  }
}

// IPC: Close App button in sidebar calls this
ipcMain.on('window-close', () => { app.quit(); });
ipcMain.on('window-minimize', () => { if (mainWindow) mainWindow.minimize(); });
ipcMain.on('window-maximize', () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) mainWindow.unmaximize();
    else mainWindow.maximize();
  }
});
ipcMain.on('open-external', (_, url) => { shell.openExternal(url); });
ipcMain.on('check-for-updates', () => { if (app.isPackaged) checkForUpdates(); });

app.whenReady().then(() => {
  buildMenu();
  createWindow();
});

// Quit when all windows are closed
app.on('window-all-closed', () => { app.quit(); });

app.on('activate', () => {
  if (mainWindow === null) createWindow();
});
