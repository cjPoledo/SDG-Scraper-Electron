import { app, BrowserWindow, ipcMain, shell } from 'electron'
import { join } from 'path'
import { openDb } from './storage/db.js'
import { registerIpcHandlers } from './ipc/handlers.js'

// ─── Globals ────────────────────────────────────────────────────────────────
let mainWindow = null
let db = null

// ─── Window factory ─────────────────────────────────────────────────────────
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#030712', // matches bg-gray-950
    show: false, // show only after ready-to-show to avoid flash
    webPreferences: {
      // Security: context isolation ON, Node.js in renderer OFF
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false, // must be false to allow preload script to use require()
      preload: join(__dirname, '../preload/index.js'),
    },
  })

  // Open external links in the OS browser, not in Electron
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
  })

  // Dev: load Vite dev server; Prod: load built file
  if (process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// ─── App lifecycle ───────────────────────────────────────────────────────────
app.whenReady().then(() => {
  // Open the database and run migrations before creating the window
  db = openDb()

  // Register all IPC handlers (passes db so handlers can query it)
  registerIpcHandlers(ipcMain, db, mainWindow)

  createWindow()

  app.on('activate', () => {
    // macOS: re-create window when dock icon is clicked and no windows are open
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  // On macOS it's conventional to keep the app running until explicitly quit
  if (process.platform !== 'darwin') app.quit()
})

app.on('quit', () => {
  if (db) {
    db.close()
    db = null
  }
})

// ─── Security: prevent new window creation ───────────────────────────────────
app.on('web-contents-created', (_event, contents) => {
  contents.on('will-navigate', (event, url) => {
    // Allow navigation only to renderer URL in dev mode
    if (process.env['ELECTRON_RENDERER_URL'] && url.startsWith(process.env['ELECTRON_RENDERER_URL'])) return
    if (url.startsWith('file://')) return
    event.preventDefault()
  })
})
