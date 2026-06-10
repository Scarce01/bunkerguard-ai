import { defineConfig, loadEnv } from 'vite'
import path from 'path'
import fs from 'fs'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { getLLMProvider, type ChatMessage } from './src/lib/llm-provider'
import { spawn } from 'child_process'

/**
 * Load .env.local at startup and expose the keys to the server-side proxies
 * (copilot, evidence-report). Without this, Vite would only expose VITE_*
 * prefixed vars to client code — but the Python subprocess + Anthropic SDK
 * need the unprefixed names.  Maps VITE_SUPABASE_URL → SUPABASE_URL etc.
 */
function loadServerEnv() {
  const env = loadEnv('development', process.cwd(), '')
  const aliasIn = (from: string, to: string) => {
    if (!process.env[to] && env[from]) process.env[to] = env[from]
  }
  // VITE_* aliases so we don't need duplicate lines in .env.local
  aliasIn('VITE_SUPABASE_URL',      'SUPABASE_URL')
  aliasIn('VITE_SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_KEY')
  // Pass through unprefixed names if user set them directly
  for (const k of ['ANTHROPIC_API_KEY', 'AWS_BEDROCK_REGION', 'AWS_BEDROCK_MODEL_ID',
                   'BACKEND_REPO_PATH', 'PYTHON_EXECUTABLE',
                   'SUPABASE_URL', 'SUPABASE_SERVICE_KEY']) {
    if (!process.env[k] && env[k]) process.env[k] = env[k]
  }
  // Sensible default — points the Python runner at the backend repo
  if (!process.env.BACKEND_REPO_PATH) process.env.BACKEND_REPO_PATH = 'D:/next bunker'
}
loadServerEnv()


function figmaAssetResolver() {
  return {
    name: 'figma-asset-resolver',
    resolveId(id) {
      if (id.startsWith('figma:asset/')) {
        const filename = id.replace('figma:asset/', '')
        return path.resolve(__dirname, 'src/assets', filename)
      }
    },
  }
}

/**
 * Serve terminal GLB models under /models/ from a configurable directory.
 * Vite already serves files from `public/` at the root, so this middleware
 * is now an optional fallback for development setups that keep oversized
 * GLBs outside the repo (e.g. when the clone is on a small partition).
 *
 * Set MODELS_DIR in .env.local to override the default. Path safety:
 * basename only — no traversal possible.
 */
function externalModelServer() {
  const externalDir = process.env.MODELS_DIR || path.resolve(__dirname, 'public/models')
  return {
    name: 'external-models',
    configureServer(server) {
      server.middlewares.use('/models', (req, res, next) => {
        try {
          const url = req.url || ''
          const filename = path.basename(url.split('?')[0])
          const externalPath = path.join(externalDir, filename)
          if (fs.existsSync(externalPath)) {
            res.setHeader('Content-Type', 'model/gltf-binary')
            res.setHeader('Cache-Control', 'public, max-age=86400')
            fs.createReadStream(externalPath).pipe(res)
            return
          }
        } catch (e) { /* fall through to next middleware */ }
        next()
      })
    },
  }
}

/**
 * /api/copilot — keeps the LLM API key server-side. Uses the swappable
 * provider in src/lib/llm-provider.ts so swapping Anthropic → AWS Bedrock
 * later only touches that file.
 */
function copilotProxy() {
  return {
    name: 'copilot-proxy',
    configureServer(server) {
      server.middlewares.use('/api/copilot', async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.end('POST only')
          return
        }
        try {
          const chunks: Buffer[] = []
          for await (const chunk of req) chunks.push(chunk as Buffer)
          const body = JSON.parse(Buffer.concat(chunks).toString('utf-8') || '{}') as {
            system?: string
            messages?: ChatMessage[]
            maxTokens?: number
          }
          const provider = getLLMProvider(process.env as Record<string, string | undefined>)
          const result = await provider.chat({
            system: body.system ?? 'You are BunkerGuard Copilot.',
            messages: body.messages ?? [],
            maxTokens: body.maxTokens ?? 700,
          })
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ ...result, provider: provider.name }))
        } catch (e: any) {
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: e?.message ?? String(e) }))
        }
      })
    },
  }
}

/**
 * /api/evidence-report — spawns the Python evidence-report service for a
 * session_id. Keeps secrets server-side. POST body: { session_id: string }
 * Response: { ok, report, hashed_at, anchored, anchor_tx, store_error? }
 */
function evidenceReportProxy() {
  return {
    name: 'evidence-report-proxy',
    configureServer(server) {
      server.middlewares.use('/api/evidence-report', async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.end('POST only')
          return
        }
        try {
          const chunks: Buffer[] = []
          for await (const chunk of req) chunks.push(chunk as Buffer)
          const body = JSON.parse(Buffer.concat(chunks).toString('utf-8') || '{}') as { session_id?: string }
          if (!body.session_id) {
            res.statusCode = 400
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ ok: false, error: 'session_id required' }))
            return
          }

          const py = spawn(
            process.env.PYTHON_EXECUTABLE || 'python',
            [path.resolve(__dirname, 'scripts/evidence_report_runner.py'), body.session_id],
            {
              env: {
                ...process.env,
                BACKEND_REPO_PATH: process.env.BACKEND_REPO_PATH || 'D:/next bunker',
              },
              shell: false,
            },
          )
          let stdout = ''
          let stderr = ''
          py.stdout.on('data', (d) => { stdout += d.toString() })
          py.stderr.on('data', (d) => { stderr += d.toString() })
          py.on('close', (code) => {
            res.setHeader('Content-Type', 'application/json')
            // The runner already prints JSON whether success or error.
            if (stdout.trim()) {
              res.statusCode = code === 0 ? 200 : 500
              res.end(stdout.trim())
            } else {
              res.statusCode = 500
              res.end(JSON.stringify({ ok: false, error: 'Python process produced no output', stderr: stderr.slice(0, 500) }))
            }
          })
          py.on('error', (e) => {
            res.statusCode = 500
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ ok: false, error: `spawn failed: ${e.message}. Is python on PATH?` }))
          })
        } catch (e: any) {
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ ok: false, error: e?.message ?? String(e) }))
        }
      })
    },
  }
}

export default defineConfig({
  plugins: [
    figmaAssetResolver(),
    externalModelServer(),
    copilotProxy(),
    evidenceReportProxy(),
    // The React and Tailwind plugins are both required for Make, even if
    // Tailwind is not being actively used – do not remove them
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      // Alias @ to the src directory
      '@': path.resolve(__dirname, './src'),
    },
  },

  // File types to support raw imports. Never add .css, .tsx, or .ts files to this.
  assetsInclude: ['**/*.svg', '**/*.csv'],
})
