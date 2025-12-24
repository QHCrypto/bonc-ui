import fs from 'node:fs'
import path from 'node:path'

const target = path.join(
  'node_modules',
  'nitro',
  'dist',
  'node_modules',
  'get-port-please',
  'dist',
  'index.mjs',
)

const marker = 'process.platform === "win32" && globalThis.Bun'

if (!fs.existsSync(target)) {
  console.log('Nitro socket patch: target not found, skipping.')
  process.exit(0)
}

const content = fs.readFileSync(target, 'utf8')
if (content.includes(marker)) {
  console.log('Nitro socket patch: already applied.')
  process.exit(0)
}

const needle = 'if (globalThis.process?.versions?.webcontainer) {'
const insert = [
  '  if (process.platform === "win32" && globalThis.Bun) {',
  '    _isSocketSupported = false;',
  '    return false;',
  '  }',
].join('\n')

if (!content.includes(needle)) {
  console.error('Nitro socket patch: anchor not found.')
  process.exit(1)
}

const patched = content.replace(needle, `${insert}\n  ${needle}`)
fs.writeFileSync(target, patched, 'utf8')
console.log('Nitro socket patch: applied.')
