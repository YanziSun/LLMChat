import type { ModelConfig } from '../types'
import { logError, logInfo } from './logger'

export type ContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } }

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string | ContentPart[]
}

export interface StreamCallbacks {
  onChunk: (chunk: string) => void
  onDone: () => void
  onError: (error: string) => void
}

// Parse API error body into readable message
async function parseErrorBody(response: Response): Promise<string> {
  const raw = await response.text()
  try {
    const json = JSON.parse(raw)
    // OpenAI-style error object
    const msg = json?.error?.message ?? json?.message ?? json?.detail ?? raw
    return String(msg)
  } catch {
    return raw || '(empty response body)'
  }
}

// Suggest likely cause based on status code
function errorHint(status: number): string {
  switch (status) {
    case 401: return '可能原因：API Key 无效或未填写'
    case 403: return '可能原因：API Key 没有权限访问该模型'
    case 404: return '可能原因：Base URL 或 Model ID 填写有误'
    case 429: return '可能原因：请求频率过高或配额已用完'
    case 500: return '可能原因：服务端内部错误，请稍后重试'
    case 502:
    case 503:
    case 504: return '可能原因：服务暂时不可用，请检查 Base URL 是否正确'
    default: return ''
  }
}

export async function streamChat(
  model: ModelConfig,
  messages: ChatMessage[],
  callbacks: StreamCallbacks,
  signal?: AbortSignal
): Promise<void> {
  const baseUrl = model.baseUrl.replace(/\/$/, '')
  const url = `${baseUrl}/chat/completions`

  logInfo(`[streamChat] → ${model.name} (${model.modelId}), ${messages.length} messages`)

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${model.apiKey}`,
      },
      body: JSON.stringify({
        model: model.modelId,
        messages,
        stream: true,
      }),
      signal,
    })

    if (!response.ok) {
      const body = await parseErrorBody(response)
      const hint = errorHint(response.status)
      const lines = [
        `HTTP ${response.status} ${response.statusText}`,
        `URL: ${url}`,
        `Model: ${model.modelId}`,
        `错误信息: ${body}`,
        ...(hint ? [hint] : []),
      ]
      const errMsg = lines.join('\n')
      logError(`[streamChat] ${errMsg}`)
      callbacks.onError(errMsg)
      return
    }

    const reader = response.body?.getReader()
    if (!reader) {
      const errMsg = `No response body — 服务器没有返回任何内容\nURL: ${url}\nModel: ${model.modelId}`
      logError(`[streamChat] ${errMsg}`)
      callbacks.onError(errMsg)
      return
    }

    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed || trimmed === 'data: [DONE]') continue
        if (!trimmed.startsWith('data: ')) continue

        try {
          const json = JSON.parse(trimmed.slice(6))
          const delta = json.choices?.[0]?.delta?.content
          if (delta) {
            callbacks.onChunk(delta)
          }
        } catch {
          // skip malformed JSON chunk
        }
      }
    }

    logInfo(`[streamChat] ✓ ${model.name} done`)
    callbacks.onDone()
  } catch (err) {
    if ((err as Error).name === 'AbortError') {
      callbacks.onDone()
    } else {
      const e = err as Error
      let msg = e.message
      // Network-level errors — always include URL for context
      if (msg.includes('Failed to fetch') || msg.includes('NetworkError') || msg.includes('net::ERR')) {
        msg = `网络连接失败: ${e.message}\nURL: ${url}\nModel: ${model.modelId}\n可能原因：Base URL 无法访问，请检查网络或 URL 是否正确`
      } else if (msg.includes('CORS')) {
        msg = `CORS 跨域错误: ${e.message}\nURL: ${url}\n可能原因：目标 API 不允许浏览器直接调用`
      } else {
        msg = `${e.name}: ${e.message}\nURL: ${url}\nModel: ${model.modelId}`
      }
      logError(`[streamChat] ${msg}`)
      callbacks.onError(msg)
    }
  }
}

export async function generateTitle(
  model: ModelConfig,
  userMessage: string,
  assistantMessage: string
): Promise<string | null> {
  const baseUrl = model.baseUrl.replace(/\/$/, '')
  const url = `${baseUrl}/chat/completions`
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${model.apiKey}`,
      },
      body: JSON.stringify({
        model: model.modelId,
        messages: [
          { role: 'user', content: userMessage },
          { role: 'assistant', content: assistantMessage },
          { role: 'user', content: '请用一句话（不超过20个字）总结以上对话的主题，直接输出标题，不要加引号或其他格式。' },
        ],
        max_tokens: 30,
        stream: false,
      }),
    })
    if (!response.ok) return null
    const json = await response.json()
    const title = json.choices?.[0]?.message?.content?.trim()
    return title || null
  } catch {
    return null
  }
}

export async function testConnection(model: ModelConfig): Promise<{ ok: boolean; error?: string }> {
  const baseUrl = model.baseUrl.replace(/\/$/, '')
  const url = `${baseUrl}/chat/completions`

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${model.apiKey}`,
      },
      body: JSON.stringify({
        model: model.modelId,
        messages: [{ role: 'user', content: 'Hi' }],
        max_tokens: 5,
        stream: false,
      }),
    })

    if (!response.ok) {
      const body = await parseErrorBody(response)
      const hint = errorHint(response.status)
      return {
        ok: false,
        error: `HTTP ${response.status}: ${body}${hint ? `\n${hint}` : ''}`
      }
    }

    return { ok: true }
  } catch (err) {
    return { ok: false, error: (err as Error).message }
  }
}
