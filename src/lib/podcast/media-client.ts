import axios from 'axios'
import { HttpsProxyAgent } from 'https-proxy-agent'

export function mediaClient() {
  const proxy = process.env.PROXY_POOL_URL || process.env.HTTPS_PROXY || process.env.https_proxy
  return axios.create({
    ...(proxy?.startsWith('http') ? { proxy: false, httpsAgent: new HttpsProxyAgent(proxy) } : {}),
    timeout: 15_000,
    maxContentLength: 8_000_000,
    maxRedirects: 0,
    responseType: 'text',
    headers: { 'User-Agent': 'Mozilla/5.0', 'Accept-Language': 'en-US,en;q=0.9' },
  })
}

export function timedLine(seconds: number, text: string) {
  const total = Number.isFinite(seconds) && seconds > 0 ? Math.floor(seconds) : 0
  return `[${Math.floor(total / 60)
    .toString()
    .padStart(
      2,
      '0'
    )}:${(total % 60).toString().padStart(2, '0')}] ${text.replace(/\s+/g, ' ').trim()}`
}
