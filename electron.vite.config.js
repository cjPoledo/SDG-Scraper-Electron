import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'
import { copyFileSync, mkdirSync, readdirSync, existsSync } from 'fs'

// Plugin: copy static assets that electron-vite doesn't bundle automatically:
//   - src/storage/migrations/*.sql  → out/main/migrations/
//   - src/tagging/keywords.xlsx     → out/main/keywords.xlsx  (if present)
function copyStaticAssetsPlugin() {
  return {
    name: 'copy-static-assets',
    closeBundle() {
      // Migrations
      const migSrc  = resolve(__dirname, 'src/storage/migrations')
      const migDest = resolve(__dirname, 'out/main/migrations')
      mkdirSync(migDest, { recursive: true })
      for (const file of readdirSync(migSrc)) {
        copyFileSync(resolve(migSrc, file), resolve(migDest, file))
      }
      console.log('[copy-static] migrations → out/main/migrations/')

      // keywords.xlsx (optional — only copy if present)
      const xlsxSrc = resolve(__dirname, 'src/tagging/keywords.xlsx')
      if (existsSync(xlsxSrc)) {
        copyFileSync(xlsxSrc, resolve(__dirname, 'out/main/keywords.xlsx'))
        console.log('[copy-static] keywords.xlsx → out/main/')
      }
    }
  }
}

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin(), copyStaticAssetsPlugin()],
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/main.js')
        }
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/preload.js')
        }
      }
    }
  },
  renderer: {
    root: '.',
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'index.html')
        }
      }
    },
    plugins: [react()]
  }
})
