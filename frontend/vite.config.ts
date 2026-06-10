import { defineConfig, loadEnv } from 'vite'
import path from 'path'
import fs from 'fs'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { getLLMProvider, type ChatMessage } from './src/lib/llm-provider'
import { spawn, execFileSync } from 'child_process'

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
                   'SUPABASE_URL', 'SUPABASE_SERVICE_KEY',
                   'EXA_API_KEY']) {
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
 * Serve oversized terminal models from D:\bunker_t7 under /models/.
 * C:\ ran out of space mid-export for Terminal 7, so its .glb lives on D:.
 * Path is checked safely (basename only) to prevent traversal.
 */
function externalModelServer() {
  const externalDir = 'D:/bunker_t7'
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
 * /api/copilot-chat — tool-using copilot. Spawns the Python runner against
 * the backend repo, which loads the session from Supabase, runs Claude with
 * the 8-tool surface (show_chart, get_verdict_brief, ...), and returns the
 * tool_calls + final answer.
 *
 * POST  { session_id, question, history?, chat_id? }
 * Reply { ok, answer, tool_calls: [{name, args, result}], usage }
 */
function copilotChatProxy() {
  return {
    name: 'copilot-chat-proxy',
    configureServer(server) {
      server.middlewares.use('/api/copilot-chat', async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.end('POST only')
          return
        }
        try {
          const chunks: Buffer[] = []
          for await (const chunk of req) chunks.push(chunk as Buffer)
          const body = Buffer.concat(chunks).toString('utf-8') || '{}'
          const pythonExe = process.env.PYTHON_EXECUTABLE || 'D:/Python/python.exe'
          const scriptPath = path.resolve(__dirname, 'scripts/copilot_chat_runner.py')
          try {
            const stdout = execFileSync(pythonExe, [scriptPath], {
              input: body,
              env: {
                ...process.env,
                BACKEND_REPO_PATH: process.env.BACKEND_REPO_PATH || 'D:/next bunker',
                PYTHONIOENCODING: 'utf-8',
                PYTHONUNBUFFERED: '1',
              },
              encoding: 'utf-8',
              maxBuffer: 8 * 1024 * 1024,
              timeout: 120_000,
              windowsHide: true,
            })
            res.setHeader('Content-Type', 'application/json')
            res.statusCode = 200
            res.end(stdout.trim() || '{"ok":false,"error":"empty stdout"}')
          } catch (e: any) {
            res.statusCode = 500
            res.setHeader('Content-Type', 'application/json')
            const sout = (e?.stdout || '').toString().slice(0, 1200)
            const serr = (e?.stderr || '').toString().slice(0, 1200)
            // If the Python runner reported a structured JSON error on stdout, surface it.
            if (sout.trim().startsWith('{')) {
              res.end(sout.trim())
            } else {
              res.end(JSON.stringify({
                ok: false,
                error: `python exit ${e?.status ?? '?'}: ${e?.message ?? String(e)}`,
                stdout: sout,
                stderr: serr,
              }))
            }
          }
        } catch (e: any) {
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ ok: false, error: e?.message ?? String(e) }))
        }
      })
    },
  }
}

/**
 * /api/copilot-asset/* — serves chart PNGs and report PDFs the copilot
 * runner wrote under BACKEND_REPO_PATH. Tools return `asset_relpath`; the
 * client fetches it via this route.
 */
function copilotAssetServer() {
  return {
    name: 'copilot-asset',
    configureServer(server) {
      server.middlewares.use('/api/copilot-asset/', (req, res, next) => {
        try {
          const backend = process.env.BACKEND_REPO_PATH || 'D:/next bunker'
          const rel = decodeURIComponent((req.url || '').split('?')[0].replace(/^\/+/, ''))
          const resolved = path.resolve(backend, rel)
          if (!resolved.startsWith(path.resolve(backend))) {
            res.statusCode = 403; res.end('forbidden'); return
          }
          if (!fs.existsSync(resolved)) { res.statusCode = 404; res.end('not found'); return }
          const ext = path.extname(resolved).toLowerCase()
          const mime =
            ext === '.png' ? 'image/png' :
            ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' :
            ext === '.svg' ? 'image/svg+xml' :
            ext === '.pdf' ? 'application/pdf' :
            ext === '.md' ? 'text/markdown; charset=utf-8' :
            'application/octet-stream'
          res.setHeader('Content-Type', mime)
          res.setHeader('Cache-Control', 'no-store')
          fs.createReadStream(resolved).pipe(res)
        } catch (e) { next() }
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

/**
 * /api/agent-output — generates Compliance / Decision agent narratives
 * via the shared LLM provider (Anthropic today, swap to Bedrock or Kiro
 * later by editing src/lib/llm-provider.ts). The system prompt forces a
 * tight 3-bullet JSON shape so the FE renders predictable output lines.
 *
 * Request:  { agent: 'compliance' | 'decision', context: {...} }
 * Response: { ok, agent, lines: string[], confidence?: number, provider }
 *
 * Keeps the LLM key server-side. Failure modes: 400 if request is malformed,
 * 500 with `error` for upstream issues. The FE hook degrades gracefully so
 * the agent shows "LLM unavailable" rather than crashing.
 */
function agentOutputProxy() {
  return {
    name: 'agent-output-proxy',
    configureServer(server) {
      server.middlewares.use('/api/agent-output', async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.end('POST only')
          return
        }
        try {
          const chunks: Buffer[] = []
          for await (const chunk of req) chunks.push(chunk as Buffer)
          const body = JSON.parse(Buffer.concat(chunks).toString('utf-8') || '{}') as {
            agent?: 'compliance' | 'decision'
            context?: Record<string, unknown>
          }
          if (!body.agent || (body.agent !== 'compliance' && body.agent !== 'decision')) {
            res.statusCode = 400
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ ok: false, error: "agent must be 'compliance' or 'decision'" }))
            return
          }
          const ctx = body.context ?? {}

          // Agent-specific system prompts.  Both demand strict JSON so the FE
          // can render predictable bullet lines without markdown parsing.
          const systems = {
            compliance: `You are the COMPLIANCE agent in a maritime bunkering fraud detection system.

Given a session's risk score, anomalies, supplier sanctions check, and evidence hashes,
write a short compliance verification summary.

Return ONLY a JSON object — no markdown, no prose:
{
  "lines": [
    "<one-line evidence package status>",
    "<one-line regulatory citation: MARPOL / MPA / ISO 8217 / SS 648 — pick the most relevant>",
    "<one-line blockchain anchor / chain-of-custody status>"
  ],
  "confidence": <0-100 integer>
}`,
            decision: `You are the DECISION agent in a maritime bunkering fraud detection system.

Given a session's risk score, anomalies, Exa intelligence, and Compliance findings,
recommend a verdict for the Chief Engineer.

Return ONLY a JSON object — no markdown, no prose:
{
  "lines": [
    "<verdict line — one of: REFUSE_TO_SIGN / SIGN_WITH_OBJECTION / APPROVE — followed by one-sentence reason>",
    "<dollar exposure or operational impact, one line>",
    "<recommended next action: LoP / independent survey / MPA notification / proceed>"
  ],
  "confidence": <0-100 integer>
}`,
          } as const

          const userMsg = `CONTEXT for session ${(ctx.session_id ?? 'unknown')}:\n` + JSON.stringify(ctx, null, 2)
          const provider = getLLMProvider(process.env as Record<string, string | undefined>)
          const result = await provider.chat({
            system: systems[body.agent],
            messages: [{ role: 'user', content: userMsg }],
            maxTokens: 400,
          })

          // The model is told to return strict JSON. Defensively tolerate
          // ```json fences or stray text by extracting the first {...} block.
          let parsed: { lines?: string[]; confidence?: number } = {}
          try {
            const match = result.text.match(/\{[\s\S]*\}/)
            if (match) parsed = JSON.parse(match[0])
          } catch {
            parsed = {}
          }
          const lines = Array.isArray(parsed.lines) ? parsed.lines.filter((l) => typeof l === 'string') : []
          if (!lines.length) {
            // Last-ditch fallback — split the raw text into lines so something shows.
            lines.push(...result.text.split('\n').filter(Boolean).slice(0, 3))
          }

          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({
            ok: true,
            agent: body.agent,
            lines,
            confidence: typeof parsed.confidence === 'number' ? parsed.confidence : undefined,
            provider: provider.name,
            modelId: result.modelId,
          }))
        } catch (e: any) {
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ ok: false, error: e?.message ?? String(e) }))
        }
      })
    },
  }
}

/**
 * /api/enrich — calls the new backend enrichment pipeline
 * (`enrichment.enrich_entities`) by spawning Python with the session's
 * extracted entities as JSON. Returns the full structured intelligence
 * payload back to the FE for the Investigator agent to surface.
 *
 * Request body: { supplier_name, vessel_name, imo_number, barge_name, port }
 * Response:     { ok, result?, error?, stderr? }
 *
 * Keeps EXA_API_KEY server-side. Spawns Python so the Vite proxy uses the
 * exact same module the backend pipeline runs in production — no logic
 * duplication, no drift between live UI and offline runs.
 */
function enrichProxy() {
  return {
    name: 'enrich-proxy',
    configureServer(server) {
      server.middlewares.use('/api/enrich', async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.end('POST only')
          return
        }
        try {
          const chunks: Buffer[] = []
          for await (const chunk of req) chunks.push(chunk as Buffer)
          const raw = Buffer.concat(chunks).toString('utf-8') || '{}'
          // Sanity check — must parse, otherwise we don't even spawn Python.
          try { JSON.parse(raw) } catch {
            res.statusCode = 400
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ ok: false, error: 'request body must be JSON' }))
            return
          }

          const py = spawn(
            process.env.PYTHON_EXECUTABLE || 'python',
            [path.resolve(__dirname, 'scripts/enrich_runner.py'), raw],
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
            if (stdout.trim()) {
              res.statusCode = code === 0 ? 200 : 500
              res.end(stdout.trim())
            } else {
              res.statusCode = 500
              res.end(JSON.stringify({ ok: false, error: 'enrich_runner produced no output', stderr: stderr.slice(0, 500) }))
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
    copilotChatProxy(),
    copilotAssetServer(),
    evidenceReportProxy(),
    enrichProxy(),
    agentOutputProxy(),
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
