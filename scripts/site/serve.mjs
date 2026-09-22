import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { resolve, extname, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { root } from './lib.mjs'

/** Die gebaute Site wie auf Pages: `/` aus apps/site/dist, `/storybook/` daneben, `/app/` daneben. */
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.png': 'image/png', '.txt': 'text/plain', '.md': 'text/plain', '.wasm': 'application/wasm' }
const mounts = [
  ['/storybook/', 'packages/toolkit/storybook-static'],
  ['/app/', 'apps/reference/dist'],
  ['/', 'apps/site/dist'],
]
createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname)
    const [prefix, dir] = mounts.find(([p]) => pathname.startsWith(p))
    const base = resolve(fileURLToPath(root), dir)
    let file = resolve(base, pathname.slice(prefix.length) || 'index.html')
    if (!file.startsWith(base + sep) && file !== base) { res.writeHead(403).end(); return }
    if ((await stat(file)).isDirectory()) file = resolve(file, 'index.html')
    res.writeHead(200, { 'Content-Type': mime[extname(file)] || 'application/octet-stream' }).end(await readFile(file))
  } catch {
    res.writeHead(404).end('not found')
  }
}).listen(Number(process.env.PORT) || 4321, '127.0.0.1', () => console.log('http://127.0.0.1:' + (process.env.PORT || 4321)))
