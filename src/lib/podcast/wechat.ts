import { load } from 'cheerio'
import { mediaClient } from './media-client'
import { isWechatSource } from './source'

export const wechatVerificationMessage =
  '微信要求完成访问验证，当前未取得文章正文。请在微信或浏览器打开原文，复制正文到「长文本」，或保存为 TXT / Markdown 上传。不要重复创建；验证页不会作为文章生成。'

function articleUrl(value: string): URL {
  const url = new URL(value)
  if (
    !isWechatSource(value) ||
    url.protocol !== 'https:' ||
    url.port ||
    url.username ||
    url.password
  )
    throw new Error('请使用 mp.weixin.qq.com 的 HTTPS 公众号文章链接')
  if (url.pathname.includes('captcha') || url.pathname.includes('verify'))
    throw new Error(wechatVerificationMessage)
  if (!/^\/s(?:\/|$)/.test(url.pathname)) throw new Error('请填写单篇公众号文章链接')
  return url
}

export function wechatArticleText(html: string, source: string): string {
  const $ = load(html)
  $('script, style, noscript').remove()
  const content = $('#js_content')
  if (!content.length) {
    const pageText = $('body').text()
    if (/环境异常|完成验证|访问过于频繁|去验证/.test(pageText))
      throw new Error(wechatVerificationMessage)
    throw new Error(
      '未取得公众号文章正文，文章可能已删除、限制访问或需要登录。请打开原文确认，复制正文到「长文本」后生成。'
    )
  }
  content.find('br').replaceWith('\n')
  content.find('p, section, div, h1, h2, h3, h4, li, blockquote').append('\n')
  const text = content
    .text()
    .replace(/[\t \u00a0]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  if (text.replace(/\s/g, '').length < 40)
    throw new Error(
      '公众号正文没有足够可提取的文字，可能是图片文章或未完整加载。请复制正文或先对图片进行文字识别。'
    )
  const title =
    $('#activity-name').text().trim() ||
    $('meta[property="og:title"]').attr('content') ||
    '未命名文章'
  const author = $('#js_name').text().trim()
  return `公众号文章：${title}\n${author ? `公众号：${author}\n` : ''}来源：${source}\n以下为文章正文：\n${text}`
}

export async function extractWechatArticle(source: string): Promise<string> {
  let url = articleUrl(source)
  const client = mediaClient()
  for (let redirects = 0; redirects <= 2; redirects++) {
    const response = await client.get(url.href, { validateStatus: () => true })
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      if (!response.headers.location) throw new Error('公众号页面重定向无效，请复制正文后生成')
      // Follow only article URLs on the same exact provider host, never captcha
      // pages or external destinations.
      url = articleUrl(new URL(response.headers.location, url).href)
      continue
    }
    if (response.status !== 200) throw new Error('公众号暂时无法访问，请稍后试读或复制正文后生成')
    return wechatArticleText(response.data, source)
  }
  throw new Error('公众号页面重定向过多，请打开原文并复制正文后生成')
}
