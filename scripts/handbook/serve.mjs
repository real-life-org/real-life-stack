import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { resolve, extname, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { root } from './lib.mjs'
const mime = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.png': 'image/png',
  '.txt': 'text/plain',
  '.md': 'text/plain',
  '.wasm': 'application/wasm',
}
createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(
      new URL(req.url, 'http://localhost').pathname,
    )
    const story = pathname.startsWith('/storybook/')
    const base = resolve(
      fileURLToPath(root),
      story ? 'packages/toolkit/storybook-static' : 'apps/docs/dist',
    )
    const suffix = pathname.replace(story ? /^\/storybook\// : /^\/docs\//, '')
    let file = resolve(base, suffix || 'index.html')
    if (!file.startsWith(base + sep) && file !== base) {
      res.writeHead(403).end()
      return
    }
    if ((await stat(file)).isDirectory()) file = resolve(file, 'index.html')
    res
      .writeHead(200, {
        'Content-Type': mime[extname(file)] || 'application/octet-stream',
      })
      .end(await readFile(file))
  } catch {
    res.writeHead(404).end('Not found')
  }
}).listen(4322, '127.0.0.1', () =>
  console.log('Handbook: http://127.0.0.1:4322/docs/de/'),
)
