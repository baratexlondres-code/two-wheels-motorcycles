const { app, BrowserWindow } = require("electron");
const path = require("path");

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (app.isPackaged) {
    // PRODUÇÃO (instalador)
    mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
  } else {
    // DESENVOLVIMENTO
    mainWindow.loadURL("http://localhost:5173");
  }

  // Abrir DevTools automaticamente (pode remover depois)
  mainWindow.webContents.openDevTools();
}

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
