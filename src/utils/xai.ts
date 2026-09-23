import { getAxiosInstance } from "./http"
import { getSetting } from '@/lib/settings'

export async function queryChat(query: string, options: { json: boolean } = { json: false }) {
    const [apiKey, url, model] = await Promise.all([
        getSetting('LLM_API_KEY'), getSetting('LLM_CHAT_URL'), getSetting('LLM_CHAT_MODEL')
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
        "search_parameters": {
            "mode": "auto"
        },
        "model": model
    }
    if (options.json) {
        payload.response_format = {
            type: "json_object"
        }
    }
    return getAxiosInstance().post(url, payload, { headers })
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
        getSetting('LLM_SEARCH_API_KEY'), getSetting('LLM_SEARCH_URL'), getSetting('LLM_SEARCH_MODEL')
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
        "search_parameters": {
            "mode": "auto"
        },
        "model": model
    }
    if (options.json) {
        payload.response_format = {
            type: "json_object"
        }
    }
    return getAxiosInstance().post(url, payload, { headers })
}
