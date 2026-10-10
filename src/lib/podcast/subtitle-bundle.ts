import type { AudioOutput } from './types'
import { sourceTextFor, sourceTextInfo } from './source-text'
import { parseSubtitles, toSrt } from './subtitles'
import { toLrc } from './lyrics'
import type { ZipEntry } from '@/lib/zip'

// The source follows the original media timeline; the target follows the podcast.
// They are different scripts, so never put source cues on the podcast timeline.
export function subtitleBundleEntries(
  task: { userInputs?: unknown; stepsDetail?: unknown },
  audio: AudioOutput,
  title: string,
  basename: string
): ZipEntry[] {
  const input = task.userInputs as { language?: string } | undefined
  const target = input?.language || 'auto'
  const lines = audio.timedScript || []
  const entries: ZipEntry[] = []
  const add = (name: string, text: string) =>
    entries.push({ name, data: Buffer.from(text, 'utf8') })
  // Same-name files are the target language for local podcast playback.
  add(`${basename}.lrc`, toLrc(lines, title))
  add(`${basename}.srt`, toSrt(lines, audio.duration))
  add(
    `目标语言-播客/${basename}-播客脚本.txt`,
    `输出语言设置：${target}\n\n${lines.map((l) => `${l.role}: ${l.text}`).join('\n\n')}`
  )
  add(`目标语言-播客/${basename}.lrc`, toLrc(lines, title))
  add(`目标语言-播客/${basename}.srt`, toSrt(lines, audio.duration))
  const source = sourceTextFor(task)
  let sourceStatus = '这期未保存来源文字稿，无法补出原字幕。'
  if (source) {
    const info = sourceTextInfo(source)
    // Preserve the exact saved text without truncation, translation or refetching.
    add(`源语言-原视频/${basename}-源文字稿.txt`, source)
    sourceStatus = `源字幕语言：${info.language || '未记录'}；保存字符数：${source.length}。`
    try {
      const cues = parseSubtitles(source)
      add(`源语言-原视频/${basename}-源字幕.lrc`, toLrc(cues, `${title}（原视频）`))
      sourceStatus += '\n源字幕 LRC 使用原视频时间轴。'
    } catch {
      sourceStatus += '\n来源没有可导出的完整时间戳，保留全文 TXT，不编造同步字幕。'
    }
  }
  add(
    `${basename}-字幕说明.txt`,
    `${sourceStatus}\n目标语言设置：${target}（auto 表示跟随资料语言）。\n根目录同名 LRC / SRT 和“目标语言-播客”对应下载的 MP3。\n“源语言-原视频”是原始提取文本，对应原视频，不能与改写后的播客逐句对齐。\n目标字幕是播客脚本，不是原字幕的全文翻译。\n旧节目的来源可能缺失或不是英文，不会自动替换或重新生成音频。\n`
  )
  return entries
}
