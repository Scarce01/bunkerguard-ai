/**
 * LLM provider abstraction.
 *
 * The FE never calls this directly — it POSTs to `/api/copilot`. The
 * Vite-middleware in `vite.config.ts` is the one that loads a concrete
 * provider via `getLLMProvider()` and forwards the call.
 *
 * Today: Anthropic. After the AWS migration: swap `getLLMProvider()` to
 * return `bedrockProvider` instead of `anthropicProvider` and nothing else
 * has to change.
 */

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatRequest {
  system: string;
  messages: ChatMessage[];
  /** Hint for the provider — most providers honour this. */
  maxTokens?: number;
}

export interface ChatResponse {
  text: string;
  inputTokens?: number;
  outputTokens?: number;
  /** Identifier of the underlying model — useful for the FE to surface. */
  modelId: string;
}

export interface LLMProvider {
  /** Human-readable provider name (shown in copilot footer). */
  name: string;
  /** Send a chat request and get a single response back. */
  chat(req: ChatRequest): Promise<ChatResponse>;
}

/* ─── Anthropic provider ────────────────────────────────────────────── */

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_MODEL = 'claude-sonnet-4-5-20250929'; // swap to a newer pin when available

export function anthropicProvider(apiKey: string): LLMProvider {
  return {
    name: 'Anthropic · Claude Sonnet',
    async chat({ system, messages, maxTokens = 800 }) {
      const res = await fetch(ANTHROPIC_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: ANTHROPIC_MODEL,
          max_tokens: maxTokens,
          system,
          messages: messages.map((m) => ({ role: m.role, content: m.content })),
        }),
      });
      if (!res.ok) {
        const body = await res.text();
        throw new Error(`Anthropic ${res.status}: ${body.slice(0, 200)}`);
      }
      const data: any = await res.json();
      const text =
        Array.isArray(data?.content)
          ? data.content.filter((b: any) => b.type === 'text').map((b: any) => b.text).join('\n').trim()
          : '';
      return {
        text: text || '(empty response)',
        inputTokens: data?.usage?.input_tokens,
        outputTokens: data?.usage?.output_tokens,
        modelId: data?.model ?? ANTHROPIC_MODEL,
      };
    },
  };
}

/* ─── AWS Bedrock provider (stub for the future swap) ──────────────── */

/**
 * Stub. When you migrate to AWS Bedrock, fill this out:
 *  - Sign requests with the AWS SDK v3 BedrockRuntimeClient
 *  - Use `anthropic.claude-sonnet-4-5-v1:0` (or whatever model ID Bedrock exposes)
 *  - Map the response back into ChatResponse
 *
 * Until then this throws — `getLLMProvider()` returns the Anthropic impl.
 */
export function bedrockProvider(_config: { region: string; modelId: string }): LLMProvider {
  return {
    name: 'AWS Bedrock · Claude Sonnet',
    async chat() {
      throw new Error('Bedrock provider not yet implemented. Switch back to Anthropic in getLLMProvider().');
    },
  };
}

/* ─── Resolver — change this single function when switching providers ─ */

export function getLLMProvider(env: Record<string, string | undefined>): LLMProvider {
  // Prefer AWS once configured
  if (env.AWS_BEDROCK_REGION && env.AWS_BEDROCK_MODEL_ID) {
    return bedrockProvider({ region: env.AWS_BEDROCK_REGION, modelId: env.AWS_BEDROCK_MODEL_ID });
  }
  // Fall back to Anthropic during development
  const key = env.ANTHROPIC_API_KEY;
  if (!key) {
    throw new Error('No LLM provider configured. Set ANTHROPIC_API_KEY (dev) or AWS_BEDROCK_* (prod).');
  }
  return anthropicProvider(key);
}
