import { INPUT_MAX_CHARACTERS } from './limits'
import { isWechatSource, safeSourceUrl } from './source'

export type WechatImport = {
  title: string
  author: string
  url: string
  content: string
  text: string
}
export function parseWechatImport(raw: string): WechatImport {
  if (raw.length > INPUT_MAX_CHARACTERS * 7) throw new Error('导入内容过大，请拆分正文后上传')
  let data
  try {
    data = JSON.parse(raw)
  } catch {
    throw new Error('请粘贴“导入到声笺”书签复制的内容')
  }
  if (data?.format !== 'ys-wechat-article-v1' || typeof data.content !== 'string')
    throw new Error('不是有效的公众号导入内容')
  const url = safeSourceUrl(data.url)
  if (
    !url ||
    !url.startsWith('https:') ||
    !isWechatSource(url) ||
    !/^\/s(?:\/|$)/.test(new URL(url).pathname)
  )
    throw new Error('来源必须是 HTTPS 微信公众号文章链接')
  const title =
    typeof data.title === 'string'
      ? data.title
          .replace(/[\r\n]+/g, ' ')
          .trim()
          .slice(0, 300)
      : '公众号文章'
  const author =
    typeof data.author === 'string'
      ? data.author
          .replace(/[\r\n]+/g, ' ')
          .trim()
          .slice(0, 100)
      : ''
  const content = data.content.trim()
  if (content.replace(/\s/g, '').length < 40)
    throw new Error('正文太短，请确认已打开完整文章，而不是验证页')
  const text = `公众号文章：${title}\n${author ? `公众号：${author}\n` : ''}来源：${url}\n以下为文章正文：\n${content}`
  if (text.length > INPUT_MAX_CHARACTERS)
    throw new Error('正文超过 10 万字符，请拆分；不会自动截断')
  return { title, author, url, content, text }
}

// Self-contained, local-only bookmarklet. No network calls or access to cookies.
export const WECHAT_BOOKMARKLET = `javascript:void(async function(){
if(location.hostname!=='mp.weixin.qq.com'||!/^\\/s(?:\\/|$)/.test(location.pathname)){alert('请先在浏览器打开微信公众号文章，再点击此书签');return;}
var article=document.querySelector('#js_content');
if(!article){alert('未找到正文，请先完成微信访问验证并打开完整文章；不会复制验证页');return;}
var content=article.innerText.trim();
if(content.replace(/\\s/g,'').length<40){alert('正文太短或尚未加载，请确认文章已经展开');return;}
var data=JSON.stringify({format:'ys-wechat-article-v1',title:(document.querySelector('#activity-name')?.innerText||document.title).trim(),author:(document.querySelector('#js_name')?.innerText||'').trim(),url:location.href,content:content});
var success=false;
try{await navigator.clipboard.writeText(data);success=true;}catch(e){}
if(success){alert('已复制完整正文（'+content.length+' 字符）。回到声笺，新建节目 → 长文本 → 公众号浏览器导入 → 粘贴并预览。尚未创建节目或消耗额度。');return;}
var box=document.createElement('div');box.style.cssText='position:fixed;inset:8%;z-index:2147483647;background:white;color:#222;padding:24px;border:2px solid #2463eb;overflow:auto;';
var note=document.createElement('p');note.textContent='浏览器不允许自动复制。请选中下方全部内容并复制，回到声笺粘贴导入。';
var input=document.createElement('textarea');input.value=data;input.style.cssText='width:100%;height:70%;';
var close=document.createElement('button');close.textContent='关闭';close.onclick=function(){box.remove();};
box.append(note,input,close);document.body.append(box);input.focus();input.select();
}())`.replace(/\n/g, '')
