import { spawn } from 'child_process'
import { mkdtemp, readFile, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import path from 'path'
import ffmpegPath from 'ffmpeg-static'
import { ScriptItem } from './types'
import { toLrc } from './lyrics'

export type TimedScriptItem = { role: string; text: string; startMs: number }

function synchsafe(size: number): Buffer {
  return Buffer.from([(size >>> 21) & 127, (size >>> 14) & 127, (size >>> 7) & 127, size & 127])
}

function id3Frame(name: string, body: Buffer): Buffer {
  const size = Buffer.alloc(4)
  size.writeUInt32BE(body.length)
  return Buffer.concat([Buffer.from(name, 'ascii'), size, Buffer.alloc(2), body])
}

function utf16(text: string): Buffer {
  return Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(text, 'utf16le')])
}

function id3Text(text: string): Buffer {
  return Buffer.concat([Buffer.from([1]), utf16(text)])
}

function withoutLeadingId3(mp3: Buffer): Buffer {
  if (mp3.length < 10 || mp3.toString('ascii', 0, 3) !== 'ID3') return mp3
  const size = ((mp3[6] & 127) << 21) | ((mp3[7] & 127) << 14) | ((mp3[8] & 127) << 7) | (mp3[9] & 127)
  const footer = mp3[3] === 4 && (mp3[5] & 0x10) !== 0 ? 10 : 0
  if (10 + size + footer >= mp3.length) throw new Error('Invalid ID3 tag size')
  return mp3.subarray(10 + size + footer)
}

// ID3v2.3/UTF-16 is understood by more desktop players than v2.4/UTF-8.
// USLT carries LRC timestamps for players that only read the common lyrics
// field; SYLT carries the same timings in the standard synchronized frame.
export function embedScript(mp3: Buffer, lines: TimedScriptItem[], durationSeconds: number, title = '驿路通·声笺'): Buffer {
  const fullText = lines.map(line => `${line.role}: ${line.text}`).join('\n')
  const uslt = Buffer.concat([Buffer.from([1]), Buffer.from('zho', 'ascii'), Buffer.alloc(2), utf16(toLrc(lines, title))])
  const syltHeader = Buffer.concat([Buffer.from([1]), Buffer.from('zho', 'ascii'), Buffer.from([2, 1]), Buffer.alloc(2)])
  const syltLines = lines.map(line => {
    const timestamp = Buffer.alloc(4)
    timestamp.writeUInt32BE(Math.max(0, Math.round(line.startMs)))
    return Buffer.concat([utf16(`${line.role}: ${line.text}`), Buffer.alloc(2), timestamp])
  })
  const tlen = Buffer.from(`\x00${Math.round(durationSeconds * 1000)}`, 'ascii')
  const frames = Buffer.concat([
    id3Frame('TIT2', id3Text(title)),
    id3Frame('TPE1', id3Text('驿路通')),
    id3Frame('TALB', id3Text('驿路通·声笺')),
    id3Frame('USLT', uslt), id3Frame('SYLT', Buffer.concat([syltHeader, ...syltLines])),
    id3Frame('TXXX', Buffer.concat([Buffer.from([1]), utf16('LYRICS'), Buffer.alloc(2), utf16(fullText)])),
    id3Frame('TLEN', tlen),
  ])
  const header = Buffer.concat([Buffer.from('ID3', 'ascii'), Buffer.from([3, 0, 0]), synchsafe(frames.length)])
  return Buffer.concat([header, frames, withoutLeadingId3(mp3)])
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

export async function finalizeMp3(parts: Buffer[], script: ScriptItem[], title?: string) {
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
    return { audio: embedScript(normalized, timedScript, duration, title), duration, timedScript }
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

// Re-encode a legacy concatenated MP3 before replacing its metadata. A TLEN
// tag alone cannot repair players that stop at the first segment's Xing header.
export async function normalizeExistingMp3(audio: Buffer, lines: TimedScriptItem[], previousDuration: number, title: string) {
  const normalized = await finalizeMp3([audio], [{ role: '', text: '' }], title)
  const bytes = normalized.audio
  const tagSize = ((bytes[6] & 127) << 21) | ((bytes[7] & 127) << 14) | ((bytes[8] & 127) << 7) | (bytes[9] & 127)
  const rawAudio = bytes.subarray(10 + tagSize)
  const ratio = previousDuration > 0 ? normalized.duration / previousDuration : 1
  const timedScript = lines.map(line => ({ ...line, startMs: Math.round(line.startMs * ratio) }))
  return { audio: embedScript(rawAudio, timedScript, normalized.duration, title), duration: normalized.duration, timedScript }
}
