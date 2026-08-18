// VS Code's integrated terminal sets ELECTRON_RUN_AS_NODE=1 for its own subprocess
// tooling, and that env var leaks into any shell it spawns. When set, launching our
// own Electron app makes Electron run out/main/index.js as plain Node instead of the
// real app — require('electron') then returns a path string instead of the API,
// crashing on `electron.app.whenReady`. Strip it just for this process tree so dev
// works regardless of what shell/terminal launched npm.
delete process.env.ELECTRON_RUN_AS_NODE

const { spawn } = require('child_process')

const [, , ...args] = process.argv
const child = spawn(args[0], args.slice(1), {
  stdio: 'inherit',
  env: process.env,
  shell: process.platform === 'win32',
})

child.on('exit', (code) => process.exit(code ?? 0))
