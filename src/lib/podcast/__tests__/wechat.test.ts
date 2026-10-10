import axios from 'axios'
import { extractWechatArticle, wechatArticleText } from '../wechat'
import { isWechatSource, sourceUrlFor } from '../source'
import { PodcastInputType } from '../types'
jest.mock('axios')
const url = 'https://mp.weixin.qq.com/s/example?scene=1'

it('extracts only article text with title, paragraph breaks and original URL', () => {
  const html = `<h1 id="activity-name">真正的标题</h1><div id="js_name">示例公众号</div>
  <div id="js_content" style="display:none"><p>${'这是正文，应该用于生成播客。'.repeat(8)}</p><p>第二段<br>另起一行</p><script>bad()</script></div>
  <footer>点赞 评论 广告</footer>`
  const text = wechatArticleText(html, url)
  expect(text).toContain('公众号文章：真正的标题')
  expect(text).toContain('公众号：示例公众号')
  expect(text).toContain('第二段\n另起一行')
  expect(text).not.toMatch(/点赞|bad\(\)|广告/)
  expect(sourceUrlFor({ type: PodcastInputType.LongText, text })).toBe(url)
})

it.each([
  '<body>环境异常 当前环境异常，完成验证后即可继续访问。去验证</body>',
  '<body>文章已删除 点赞 评论</body>',
  '<div id="js_content"><img src="article.png"></div>',
])('never treats blocked, missing, or image-only pages as article content', (html) => {
  expect(() => wechatArticleText(html, url)).toThrow()
})

it('rejects captcha redirects without fetching the verification page', async () => {
  const get = jest
    .fn()
    .mockResolvedValue({
      status: 302,
      headers: { location: '/mp/wappoc_appmsgcaptcha?token=example' },
    })
  ;(axios.create as jest.Mock).mockReturnValue({ get })
  await expect(extractWechatArticle(url)).rejects.toThrow('微信要求完成访问验证')
  expect(get).toHaveBeenCalledTimes(1)
})

it('rejects external redirects and lookalike hosts', async () => {
  expect(isWechatSource('https://mp.weixin.qq.com.evil.example/s/example')).toBe(false)
  const get = jest
    .fn()
    .mockResolvedValue({ status: 302, headers: { location: 'https://evil.example/s/article' } })
  ;(axios.create as jest.Mock).mockReturnValue({ get })
  await expect(extractWechatArticle(url)).rejects.toThrow('HTTPS 公众号文章链接')
  expect(get).toHaveBeenCalledTimes(1)
})

it('follows an article redirect and returns genuine content', async () => {
  const get = jest
    .fn()
    .mockResolvedValueOnce({ status: 302, headers: { location: '/s/final' } })
    .mockResolvedValueOnce({
      status: 200,
      data: `<div id="js_content">${'文章正文。'.repeat(20)}</div>`,
    })
  ;(axios.create as jest.Mock).mockReturnValue({ get })
  expect(await extractWechatArticle(url)).toContain('文章正文。')
})
