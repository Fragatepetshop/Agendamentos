const { app, BrowserWindow, dialog } = require("electron");
const path = require("path");
const net = require("net");
const fs = require("fs");

const isDev = !app.isPackaged;
let currentPort = 3000;
let splashWindow = null;
let serverStarted = false;

function writeDesktopLog(message) {
  try {
    const logDir = app.getPath("userData");
    fs.mkdirSync(logDir, { recursive: true });
    fs.appendFileSync(path.join(logDir, "desktop.log"), `[${new Date().toISOString()}] ${message}\n`);
  } catch {}
}

function waitForPort(port, host = "127.0.0.1", timeoutMs = 30000) {
  const startedAt = Date.now();

  return new Promise((resolve, reject) => {
    function tryConnect() {
      const socket = new net.Socket();

      socket
        .once("connect", () => {
          socket.end();
          resolve();
        })
        .once("error", () => {
          socket.destroy();
          if (Date.now() - startedAt >= timeoutMs) {
            reject(new Error(`Timeout aguardando porta ${port}`));
            return;
          }
          setTimeout(tryConnect, 300);
        })
        .connect(port, host);
    }

    tryConnect();
  });
}

function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();

    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : null;
      server.close(() => {
        if (port) {
          resolve(port);
        } else {
          reject(new Error("Nao foi possivel obter uma porta local livre"));
        }
      });
    });

    server.on("error", reject);
  });
}

async function startNextServer() {
  if (isDev) {
    return Promise.resolve();
  }

  if (serverStarted) {
    return waitForPort(currentPort);
  }

  currentPort = await getFreePort();
  const serverEntry = path.join(process.resourcesPath, "dist-electron", "server.js");
  const serverCwd = path.join(process.resourcesPath, "dist-electron");
  writeDesktopLog(`Iniciando servidor interno em ${serverEntry} na porta ${currentPort}`);
  process.env.PORT = String(currentPort);
  process.env.HOSTNAME = "127.0.0.1";
  process.chdir(serverCwd);
  require(serverEntry);
  serverStarted = true;

  return waitForPort(currentPort);
}

function createSplashWindow() {
  splashWindow = new BrowserWindow({
    width: 460,
    height: 420,
    frame: false,
    alwaysOnTop: true,
    resizable: false,
    maximizable: false,
    minimizable: false,
    movable: true,
    show: true,
    backgroundColor: "#f8fafc",
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  splashWindow.loadFile(path.join(__dirname, "splash.html"));
}

async function createWindow() {
  createSplashWindow();
  await startNextServer();

  const mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1200,
    minHeight: 760,
    backgroundColor: "#f8fafc",
    autoHideMenuBar: true,
    icon: path.join(app.isPackaged ? process.resourcesPath : path.join(__dirname, ".."), "assets", "app-icon.svg"),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  const url = isDev ? "http://localhost:3000" : `http://127.0.0.1:${currentPort}`;
  await mainWindow.loadURL(url);
  if (splashWindow && !splashWindow.isDestroyed()) {
    splashWindow.close();
    splashWindow = null;
  }
}

app.whenReady().then(() => {
  createWindow().catch((error) => {
    writeDesktopLog(`Falha ao abrir a aplicacao desktop: ${error?.stack || error}`);
    dialog.showErrorBox(
      "Falha ao abrir o aplicativo",
      `Nao foi possivel iniciar o painel.\n\nDetalhe: ${error instanceof Error ? error.message : String(error)}\n\nVerifique o arquivo desktop.log em:\n${app.getPath("userData")}`
    );
    app.quit();
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow().catch(() => app.quit());
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  serverStarted = false;
});
