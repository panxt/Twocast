import { queryChat, parseLLMJson } from "@/utils/xai"
import axios from "axios"
import * as cheerio from 'cheerio'
import { Platform, ScriptItem } from "./types"
import { multiTextLength } from "@/utils/text"
import { getAxiosInstance } from "@/utils/http"
import { ChatCompletion } from "openai/resources/chat/completions"

export async function retry<T>(fn: () => Promise<T>, maxRetries = 3, delay = 3000) {
  let retries = 0
  let savedError: any
  while (retries < maxRetries) {
    try {
      return await fn()
    } catch (error) {
      retries++
      if (retries < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, delay))
      } else {
        console.warn(`Failed to execute function after ${maxRetries} retries, error: ${error}`)
        savedError = error
      }
    }
  }
  console.error(`Failed to execute function after ${maxRetries} retries, error: ${savedError}`)
  throw savedError
}

export async function extractTextFromUrl(url: string) {
  const resp = await retry(() => getAxiosInstance({ proxy: process.env.PROXY_POOL_URL, throwError: true }).get(url))
  if (resp.status != 200) {
    throw new Error(`Failed to get ${url}, status: ${resp.status}, body: ${resp.data?.slice(0, 100)}`)
  }
  const $ = cheerio.load(resp.data)
  // remove all script and style tags
  $('script').remove()
  $('style').remove()
  let text = $('body').text()
  text = text.replace(/[\n\r]+/g, '\n')
  text = text.replace(/[\t]+/g, ' ')
  text = text.replace(/[\s]+/g, ' ')
  text = text.replace(/[\s]+/g, ' ')
  text = text.replace(/\n\s*\n/g, '\n')
  return text
}

export async function extractHotLinksFromUrl(url: string): Promise<{ title: string, url: string }[]> {
  const resp = await retry(() => getAxiosInstance({ proxy: process.env.PROXY_POOL_URL, throwError: true }).get(url))
  if (resp.status != 200) {
    throw new Error(`Failed to get ${url}, status: ${resp.status}, body: ${resp.data?.slice(0, 100)}`)
  }
  let baseUrl = url
  const $ = cheerio.load(resp.data)
  if ($('base').length > 0) {
    baseUrl = $('base').attr('href') || url
  }
  // remove all script and style tags
  $('script').remove()
  $('style').remove()
  let html = $('body').html() || ''
  html = html.slice(0, 100_000)

  const host = new URL(url).host

  const resp2 = await queryChat(
    `
    从网页 [${host}] 中提取热门帖子、文章，要求：
    - 格式为 json 格式:
    {
      "links": [
        {
          "title": "title",
          "url": "url"
        }
      ]
    }
    - url: 站内链接，与 ${host} 在同一个域名下
    - 只返回前 20 个链接
    - 返回的链接必须包含标题

    The website is ${url}.
    The html is ${html}.    
    `,
    { json: true }
  )
  const data = resp2.data as ChatCompletion
  const json = parseLLMJson<{ links: any[] }>(data.choices[0].message.content!)
  return json.links.map(link => {
    if (link.url.startsWith('http')) {
      return link
    } else {
      // console.log(`link.url=${link.url}, baseUrl=${baseUrl}, new url=${new URL(link.url, baseUrl).toString()}`)
      return {
        title: link.title,
        url: new URL(link.url, baseUrl).toString()
      }
    }
  })
}

export interface ArticleData {
  title: string
  content: string
  opinions: string
}

export async function analyseArticleFromUrl(url: string): Promise<ArticleData> {
  const resp = await retry(() => getAxiosInstance({ proxy: process.env.PROXY_POOL_URL, throwError: true }).get(url))
  if (resp.status != 200) {
    throw new Error(`Failed to get ${url}, status: ${resp.status}, body: ${resp.data?.slice(0, 100)}`)
  }
  const $ = cheerio.load(resp.data)
  // remove all script and style tags
  $('script').remove()
  $('style').remove()
  let html = $('body').html() || ''
  html = html.slice(0, 100_000)

  const resp2 = await queryChat(`
    从html中，提取主要内容，要求：
    - 最多500字
    - 返回 json 格式:
      - title: 文章标题
      - content: 总结文章核心内容，突出具体的数字、效果、影响等
      - opinions: 各方观点

    The website is ${url}.
    The html is ${html}.
    `,
    { json: true }
  )
  const data = resp2.data as ChatCompletion
  // console.log('data', JSON.stringify(data, null, 2))
  const json = parseLLMJson<any>(data.choices[0].message.content!)
  return json
}
