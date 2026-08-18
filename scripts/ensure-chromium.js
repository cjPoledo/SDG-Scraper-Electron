// Installs Chromium into node_modules/playwright-core/.local-browsers, which
// electron-builder's extraResources config copies to resources/chromium in the
// packaged app (see package.json). Runs on `npm install` and again right before
// every `electron-builder` invocation, so a stale/missing .local-browsers (e.g.
// left over from a Playwright install that used the OS-wide cache instead) can
// never silently produce an installer that has no browser to launch.
process.env.PLAYWRIGHT_BROWSERS_PATH = '0'

const { execFileSync } = require('child_process')
const { existsSync, readdirSync } = require('fs')
const { join } = require('path')

execFileSync(
  'npx',
  ['playwright', 'install', 'chromium'],
  { stdio: 'inherit', env: process.env, shell: process.platform === 'win32' }
)

const localBrowsersDir = join(__dirname, '..', 'node_modules', 'playwright-core', '.local-browsers')
const installedChromium = existsSync(localBrowsersDir)
  ? readdirSync(localBrowsersDir).find((name) => name.startsWith('chromium-'))
  : null

if (!installedChromium) {
  console.error(
    `\nERROR: Chromium was not found in ${localBrowsersDir} after install.\n` +
    'The packaged app will not have a browser to launch. Aborting.\n'
  )
  process.exit(1)
}

console.log(`Chromium ready for packaging: ${join(localBrowsersDir, installedChromium)}`)
