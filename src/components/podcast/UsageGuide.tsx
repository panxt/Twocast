import {
  DOCUMENT_MAX_BYTES,
  DOCUMENT_MAX_PAGES,
  INPUT_MAX_CHARACTERS,
  PRODUCTION_DAILY_EPISODES,
} from '@/lib/podcast/limits'

export function UsageGuide({ resources = false }: { resources?: boolean }) {
  return (
    <details className="rounded-control border border-rule bg-paper p-3 text-sm text-ink-soft">
      <summary className="cursor-pointer font-semibold text-ink">
        {resources ? '使用范围与资源说明' : '支持哪些资料？查看使用说明'}
      </summary>
      <div className="mt-3 flex flex-col gap-2 leading-6">
        <p>
          支持主题、公开网页链接、粘贴正文，以及 PDF、TXT、Markdown
          文件。自己的博客可以粘贴正文、上传 Markdown，或提供公开文章链接。
        </p>
        <p>
          文件最多 {DOCUMENT_MAX_BYTES / 1_000_000} MB；PDF 最多 {DOCUMENT_MAX_PAGES}{' '}
          页；正文或提取文字最多 {INPUT_MAX_CHARACTERS / 10_000} 万字符。PDF
          需包含可复制文字，扫描件请先做 OCR；TXT、Markdown 请使用 UTF-8 编码。
        </p>
        <p>
          网页只读取可访问的文字。B
          站等视频页面可能只有标题和简介，生成成功不表示已转录视频声音或完整字幕；要按视频内容生成，请粘贴字幕。登录才能查看、反爬或动态加载的网页可能无法读取。
        </p>
        <p>
          主题需要搜索模型；其他资料需要聊天模型和一种语音
          API。生成是整理与改写，不保证逐字朗读或保留全部内容；长文也受所选模型上下文和 API
          额度约束。
        </p>
        <p>
          默认每个账号每天最多生成 {PRODUCTION_DAILY_EPISODES} 期（按 UTC
          日期统计，失败记录不占次数），默认同一时间最多 1
          个未完成任务，管理员可在团队工作台调整。邀请码的兑换次数、管理员授权和成员 API
          分享额度分别计算。
        </p>
        <p>
          团队工作台可导入已有 MP3 / WAV（最大 50 MB），并附带 LRC / SRT 字幕；导出的 MP3
          附带脚本文本，并可下载 LRC，歌词显示取决于播放器是否支持本地歌词。
        </p>
        {resources && (
          <>
            <p>原文件、音频和封面存入云端私有存储；Serverless 的内存和临时磁盘不是长期存储空间。</p>
            <p>
              免费方案参考：Supabase 文件存储 1 GB、数据库 500 MB，普通出站流量和缓存出站流量各 5
              GB；存储单文件上限 50
              MB。均为平台共享额度，并非每位用户独享，也不是实时剩余额度。实际套餐、组织用量和存储桶设置以管理员控制台为准。
            </p>
            <p>
              Vercel 上传请求整体上限 4.5 MB，因此站内文档保留为 4 MB；封面最多 3 MB。使用免费 Hobby
              + Fluid Compute 时，函数内存上限 2 GB、单次执行上限 300
              秒；后台生成按步骤运行，总耗时可超过单次执行时限。
            </p>
            <p>
              遇到空间或流量不足，请联系管理员清理文件、减少重复下载或调整套餐；超大文档请拆分。语音
              API 余额与以上平台额度相互独立。
            </p>
            <p className="text-xs">
              额度说明核对于 2026-10-01：
              <a
                href="https://supabase.com/pricing"
                target="_blank"
                rel="noreferrer"
                className="underline"
              >
                Supabase 官方额度
              </a>{' '}
              ·{' '}
              <a
                href="https://vercel.com/docs/functions/limitations"
                target="_blank"
                rel="noreferrer"
                className="underline"
              >
                Vercel 函数限制
              </a>
            </p>
          </>
        )}
      </div>
    </details>
  )
}
