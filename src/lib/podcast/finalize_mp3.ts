import { spawn } from 'child_process'
import { mkdtemp, readFile, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import path from 'path'
import ffmpegPath from 'ffmpeg-static'
import { ScriptItem } from './types'

export type TimedScriptItem = { role: string; text: string; startMs: number }

function synchsafe(size: number): Buffer {
  return Buffer.from([(size >>> 21) & 127, (size >>> 14) & 127, (size >>> 7) & 127, size & 127])
}

function id3Frame(name: string, body: Buffer): Buffer {
  return Buffer.concat([Buffer.from(name, 'ascii'), synchsafe(body.length), Buffer.alloc(2), body])
}

// ID3v2.4 USLT makes the full script readable in music apps; SYLT adds
// timestamps for apps that support synchronized lyrics.
export function embedScript(mp3: Buffer, lines: TimedScriptItem[], durationSeconds: number): Buffer {
  const fullText = lines.map(line => `${line.role}: ${line.text}`).join('\n')
  const uslt = Buffer.concat([Buffer.from([3]), Buffer.from('zho\0', 'ascii'), Buffer.from(fullText, 'utf8')])
  const syltHeader = Buffer.concat([Buffer.from([3]), Buffer.from('zho', 'ascii'), Buffer.from([2, 1, 0])])
  const syltLines = lines.map(line => {
    const timestamp = Buffer.alloc(4)
    timestamp.writeUInt32BE(Math.max(0, Math.round(line.startMs)))
    return Buffer.concat([Buffer.from(`${line.role}: ${line.text}\0`, 'utf8'), timestamp])
  })
  const tlen = Buffer.from(`\x03${Math.round(durationSeconds * 1000)}`, 'utf8')
  const frames = Buffer.concat([
    id3Frame('USLT', uslt), id3Frame('SYLT', Buffer.concat([syltHeader, ...syltLines])),
    id3Frame('TLEN', tlen),
  ])
  const header = Buffer.concat([Buffer.from('ID3', 'ascii'), Buffer.from([4, 0, 0]), synchsafe(frames.length)])
  return Buffer.concat([header, frames, mp3])
}

async function runFfmpeg(binary: string, input: string, output: string) {
  await new Promise<void>((resolve, reject) => {
    const process = spawn(binary, [
      '-hide_banner', '-loglevel', 'error', '-y', '-i', input,
      '-map', '0:a:0', '-map_metadata', '-1', '-c:a', 'libmp3lame',
      '-b:a', '128k', '-ar', '44100', '-ac', '2', '-id3v2_version', '0',
      '-write_id3v1', '0', '-write_xing', '1', output,
    ])
    let stderr = ''
    process.stderr.on('data', chunk => { stderr += String(chunk).slice(0, 400) })
    process.on('error', reject)
    process.on('close', code => code === 0 ? resolve() : reject(new Error(`FFmpeg exited ${code}: ${stderr}`)))
  })
}

async function probeDuration(binary: string, filename: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const process = spawn(binary, ['-hide_banner', '-i', filename])
    let stderr = ''
    process.stderr.on('data', chunk => { stderr += String(chunk) })
    process.on('error', reject)
    process.on('close', () => {
      const match = stderr.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/)
      if (!match) return reject(new Error(`Could not read MP3 duration: ${stderr.slice(0, 200)}`))
      resolve(Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]))
    })
  })
}

export async function finalizeMp3(parts: Buffer[], script: ScriptItem[]) {
  if (!parts.length || parts.length !== script.length) throw new Error('Audio/script segment mismatch')
  const dir = await mkdtemp(path.join(tmpdir(), 'twocast-audio-'))
  try {
    const input = path.join(dir, 'joined.mp3')
    const output = path.join(dir, 'normalized.mp3')
    // Webpack bundles ffmpeg-static's JavaScript into .next/server/chunks, so
    // its __dirname-based export points at a nonexistent chunks/ffmpeg there.
    // Next's file tracer places the included executable under node_modules.
    const binary = process.env.FFMPEG_PATH || (process.env.VERCEL === '1'
      ? path.join(process.cwd(), 'node_modules/ffmpeg-static/ffmpeg')
      : ffmpegPath)
    if (!binary) throw new Error('FFmpeg binary is unavailable')
    const segmentDurations: number[] = []
    for (let index = 0; index < parts.length; index++) {
      const segment = path.join(dir, `segment-${index}.mp3`)
      await writeFile(segment, parts[index])
      segmentDurations.push(await probeDuration(binary, segment))
    }
    await writeFile(input, Buffer.concat(parts))
    await runFfmpeg(binary, input, output)
    const normalized = await readFile(output)
    const duration = await probeDuration(binary, output)
    if (!duration || !Number.isFinite(duration)) throw new Error('Could not read finalized MP3 duration')

    const sourceDuration = segmentDurations.reduce((sum, value) => sum + value, 0)
    let startSeconds = 0
    const timedScript = script.map((line, index) => {
      const item = { role: line.role, text: line.text, startMs: Math.round(startSeconds / sourceDuration * duration * 1000) }
      startSeconds += segmentDurations[index]
      return item
    })
    return { audio: embedScript(normalized, timedScript, duration), duration, timedScript }
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}
