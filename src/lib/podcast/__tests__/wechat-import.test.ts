import vm from 'node:vm'
import { parseWechatImport, WECHAT_BOOKMARKLET } from '../wechat-import'
import { sourceUrlFor } from '../source'

const content = '这里是可以阅读的微信公众号文章正文。'.repeat(20)
const data = {
  format: 'ys-wechat-article-v1',
  title: '测试文章',
  author: '测试公众号',
  url: 'https://mp.weixin.qq.com/s/example',
  content,
}
it('preserves full content and source link through ordinary long-text generation', () => {
  const result = parseWechatImport(JSON.stringify(data))
  expect(result.content).toBe(content)
  expect(result.text.endsWith(content)).toBe(true)
  expect(sourceUrlFor({ type: 'long-text', text: result.text })).toBe(data.url)
})
it.each([
  { ...data, url: 'https://mp.weixin.qq.com.evil.com/s/test' },
  { ...data, url: 'https://mp.weixin.qq.com/mp/verify' },
  { ...data, content: '去验证' },
  { ...data, content: 'a'.repeat(100001) },
])('rejects wrong host, verification pages, short or oversized input', (input) => {
  expect(() => parseWechatImport(JSON.stringify(input))).toThrow()
})
it('rejects unstructured clipboard contents', () => {
  expect(() => parseWechatImport('ordinary clipboard')).toThrow()
  expect(() => parseWechatImport('null')).toThrow()
})
it('bookmarklet copies full article and metadata without any network requests', async () => {
  const writeText = jest.fn().mockResolvedValue(undefined)
  const alert = jest.fn()
  const context = {
    location: { hostname: 'mp.weixin.qq.com', pathname: '/s/example', href: data.url },
    document: {
      title: data.title,
      querySelector: (selector: string) => ({
        innerText:
          selector === '#js_content' ? content : selector === '#js_name' ? data.author : data.title,
      }),
    },
    navigator: { clipboard: { writeText } },
    alert,
  }
  vm.runInNewContext(WECHAT_BOOKMARKLET.slice('javascript:'.length), context)
  await new Promise((resolve) => setImmediate(resolve))
  expect(parseWechatImport(writeText.mock.calls[0][0]).content).toBe(content)
  expect(alert).toHaveBeenCalledWith(expect.stringContaining('尚未创建节目'))
})
it('bookmarklet stops on a verification page without copying anything', () => {
  const writeText = jest.fn()
  const alert = jest.fn()
  vm.runInNewContext(WECHAT_BOOKMARKLET.slice('javascript:'.length), {
    location: { hostname: 'mp.weixin.qq.com', pathname: '/s/example' },
    document: { querySelector: () => null },
    navigator: { clipboard: { writeText } },
    alert,
  })
  expect(writeText).not.toHaveBeenCalled()
  expect(alert).toHaveBeenCalledWith(expect.stringContaining('完成微信访问验证'))
})

it('bookmarklet provides selectable full text when clipboard permission is denied', async () => {
  const nodes: any[] = []
  const append = jest.fn()
  vm.runInNewContext(WECHAT_BOOKMARKLET.slice('javascript:'.length), {
    location: { hostname: 'mp.weixin.qq.com', pathname: '/s/example', href: data.url },
    document: {
      title: data.title,
      querySelector: () => ({ innerText: content }),
      createElement: (tag: string) => {
        const node = {
          tag,
          style: {},
          append: jest.fn(),
          focus: jest.fn(),
          select: jest.fn(),
          remove: jest.fn(),
          value: '',
        }
        nodes.push(node)
        return node
      },
      body: { append },
    },
    navigator: { clipboard: { writeText: jest.fn().mockRejectedValue(new Error('denied')) } },
    alert: jest.fn(),
  })
  await new Promise((resolve) => setImmediate(resolve))
  const textarea = nodes.find((n) => n.tag === 'textarea')
  expect(parseWechatImport(textarea.value).content).toBe(content)
  expect(textarea.select).toHaveBeenCalled()
  expect(append).toHaveBeenCalled()
})
