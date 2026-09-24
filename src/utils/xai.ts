import { getAxiosInstance } from "./http"
import { getApiSetting } from '@/lib/settings'
import { describeApiFailure } from '@/lib/api-errors'

export async function queryChat(query: string, options: { json: boolean } = { json: false }) {
    const [apiKey, url, model] = await Promise.all([
        getApiSetting('LLM_API_KEY'), getApiSetting('LLM_CHAT_URL'), getApiSetting('LLM_CHAT_MODEL')
    ])
    if (!apiKey) {
        throw new Error("LLM_API_KEY is not set")
    }
    if (!url) {
        throw new Error("LLM_CHAT_URL is not set")
    }
    if (!model) {
        throw new Error("LLM_CHAT_MODEL is not set")
    }
    const headers = {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
    }
    const payload: any = {
        "messages": [
            {
                "role": "user",
                "content": query
            }
        ],
        "model": model
    }
    if (new URL(url).hostname === 'api.x.ai') payload.search_parameters = { mode: 'auto' }
    if (options.json) {
        payload.response_format = {
            type: "json_object"
        }
    }
    const response = await getAxiosInstance().post(url, payload, { headers })
    if (response.status !== 200) throw describeApiFailure(response.status, '大模型')
    if (response.data?.error) throw new Error(`大模型返回错误：${String(response.data.error?.message || response.data.error).slice(0, 200)}`)
    return response
}

/**
 * Strip <think>...</think> blocks AND surrounding ```json code fences
 * before JSON.parse. Minimax's M-series models default to interleaved
 * reasoning and occasionally still wrap the final answer in a Markdown
 * JSON code fence even when response_format=json_object is requested.
 * Both must be removed or JSON.parse throws a SyntaxError.
 */
export function stripReasoning(text: string): string {
    if (!text) return text;
    let s = text.replace(/^\s*(<think>[\s\S]*?<\/think>\s*)+/, "");
    s = s.replace(/^\s*```(?:json)?\s*\n?/i, "").replace(/\n?\s*```\s*$/i, "").trimStart();
    return s;
}

export function parseLLMJson<T = unknown>(content: string): T {
    const cleaned = stripReasoning(content);
    return JSON.parse(cleaned) as T;
}

export async function querySearch(query: string, options: { json: boolean } = { json: false }) {
    const [apiKey, url, model] = await Promise.all([
        getApiSetting('LLM_SEARCH_API_KEY'), getApiSetting('LLM_SEARCH_URL'), getApiSetting('LLM_SEARCH_MODEL')
    ])
    if (!apiKey) {
        throw new Error("LLM_SEARCH_API_KEY is not set")
    }
    if (!url) {
        throw new Error("LLM_SEARCH_URL is not set")
    }
    if (!model) {
        throw new Error("LLM_SEARCH_MODEL is not set")
    }
    const headers = {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
    }
    const payload: any = {
        "messages": [
            {
                "role": "user",
                "content": query
            }
        ],
        "model": model
    }
    if (new URL(url).hostname === 'api.x.ai') payload.search_parameters = { mode: 'auto' }
    if (options.json) {
        payload.response_format = {
            type: "json_object"
        }
    }
    const response = await getAxiosInstance().post(url, payload, { headers })
    if (response.status !== 200) throw describeApiFailure(response.status, '搜索模型')
    if (response.data?.error) throw new Error(`搜索模型返回错误：${String(response.data.error?.message || response.data.error).slice(0, 200)}`)
    return response
}
