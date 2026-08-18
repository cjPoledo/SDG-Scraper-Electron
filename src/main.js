// Tell Playwright to resolve browser binaries relative to playwright-core inside
// node_modules — works both in dev and in the packaged app (asarUnpack ensures
// the .local-browsers dir is a real directory, not inside the asar archive).
process.env.PLAYWRIGHT_BROWSERS_PATH = '0'

import { app, BrowserWindow, ipcMain, Menu, shell } from 'electron'
import { join } from 'path'
import { copyFileSync, existsSync } from 'fs'
import { openDb } from './storage/db.js'
import { registerIpcHandlers } from './ipc/handlers.js'

// ─── Globals ────────────────────────────────────────────────────────────────
let mainWindow = null
let db = null

// ─── Window factory ─────────────────────────────────────────────────────────
function createWindow() {
  // Resolve icon: use .icns on macOS, .ico on Windows, .png elsewhere.
  // electron-builder handles icon conversion at build time; this covers dev mode.
  const { platform } = process
  const iconExt  = platform === 'darwin' ? 'icns' : platform === 'win32' ? 'ico' : 'png'
  const iconName = `icon.${iconExt}`
  // Walk up from out/main to find the project root resources/ folder
  const iconPath = join(__dirname, '..', '..', 'resources', iconName)

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#030712', // matches bg-gray-950
    show: false, // show only after ready-to-show to avoid flash
    icon: iconPath,
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

  // Electron doesn't show a native Cut/Copy/Paste menu on right-click by default —
  // build one from the editFlags Chromium reports for whatever was right-clicked.
  mainWindow.webContents.on('context-menu', (_event, params) => {
    if (!params.isEditable) return

    Menu.buildFromTemplate([
      { role: 'undo', enabled: params.editFlags.canUndo },
      { role: 'redo', enabled: params.editFlags.canRedo },
      { type: 'separator' },
      { role: 'cut', enabled: params.editFlags.canCut },
      { role: 'copy', enabled: params.editFlags.canCopy },
      { role: 'paste', enabled: params.editFlags.canPaste },
      { type: 'separator' },
      { role: 'selectAll', enabled: params.editFlags.canSelectAll },
    ]).popup({ window: mainWindow })
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

// ─── Keywords bootstrap ──────────────────────────────────────────────────────
// On first launch (or if the file was deleted), copy the bundled keywords.xlsx
// into the user's writable data directory. After that the user can edit it freely
// and the app will always load from userData, not from inside the asar bundle.
function bootstrapKeywords() {
  const dest = join(app.getPath('userData'), 'keywords.xlsx')
  if (!existsSync(dest)) {
    const src = join(__dirname, 'keywords.xlsx')
    if (existsSync(src)) {
      copyFileSync(src, dest)
      console.log('[keywords] Copied keywords.xlsx to userData:', dest)
    } else {
      console.warn('[keywords] Bundled keywords.xlsx not found at', src)
    }
  }
}

// ─── App lifecycle ───────────────────────────────────────────────────────────
app.whenReady().then(() => {
  // Ensure keywords.xlsx is in the user-writable userData folder
  bootstrapKeywords()

  // Open the database and run migrations before creating the window
  db = openDb()

  createWindow()

  // Pass a getter so handlers always reference the current window,
  // even if it is recreated later (macOS activate).
  registerIpcHandlers(ipcMain, db, () => mainWindow)

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
