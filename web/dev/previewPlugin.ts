import { spawn } from 'node:child_process'
import { resolve } from 'node:path'
import type { Plugin } from 'vite'

const ACCESSION = /^\d{4}\.\d{1,5}[A-Za-z]?$/
const TIMEOUT_MS = 45_000

const unavailable = JSON.stringify({
  ok: false,
  code: 'server_unavailable',
  message: 'Live preview needs the local server and the pipeline environment.',
})

function runPreview(accession: string, cwd: string): Promise<string> {
  return new Promise((resolveBody) => {
    let out = ''
    let settled = false
    const done = (body: string) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      try {
        JSON.parse(body)
        resolveBody(body)
      } catch {
        resolveBody(unavailable)
      }
    }
    // argument array, never a shell string
    const child = spawn('uv', ['run', '--project', 'pipeline', 'python', '-m', 'provenance.preview', accession], { cwd, stdio: ['ignore', 'pipe', 'ignore'] })
    const timer = setTimeout(() => {
      child.kill()
      done(unavailable)
    }, TIMEOUT_MS)
    child.stdout.on('data', (chunk: Buffer) => (out += chunk.toString('utf-8')))
    child.on('error', () => done(unavailable))
    child.on('close', () => done(out))
  })
}

/** Dev-only: GET /api/preview?accession=... runs the real pipeline on one record. Not part of the build. */
export function previewPlugin(): Plugin {
  let repoRoot = ''
  return {
    name: 'provenance-preview',
    apply: 'serve',
    configResolved(config) {
      repoRoot = resolve(config.root, '..')
    },
    configureServer(server) {
      let busy = false
      server.middlewares.use('/api/preview', async (req, res) => {
        const site = req.headers['sec-fetch-site']
        const host = req.headers.host ?? ''
        const origin = req.headers.origin
        const sameOrigin = (!site || site === 'same-origin' || site === 'none') && (!origin || new URL(origin).host === host)
        if (!sameOrigin || busy) {
          res.statusCode = sameOrigin ? 429 : 403
          res.end()
          return
        }
        busy = true
        try {
        const accession = new URL(req.url ?? '', 'http://localhost').searchParams.get('accession') ?? ''
        const body = req.method !== 'GET'
          ? unavailable
          : ACCESSION.test(accession)
            ? await runPreview(accession, repoRoot)
            : JSON.stringify({ ok: false, code: 'bad_request', message: 'An accession number looks like 1965.233 (year, a dot, a number).' })
        res.statusCode = 200
        res.setHeader('Content-Type', 'application/json')
        res.end(body)
        } finally {
          busy = false
        }
      })
    },
  }
}
