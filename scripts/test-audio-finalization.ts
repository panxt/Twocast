import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import ffmpegPath from 'ffmpeg-static'
import { embedScript, finalizeMp3, normalizeExistingMp3 } from '../src/lib/podcast/finalize_mp3'
import { toLrc } from '../src/lib/podcast/lyrics'

async function main() {
  const dir = mkdtempSync(path.join(tmpdir(), 'twocast-test-'))
  try {
    const parts = [2, 3].map((seconds, index) => {
      const filename = path.join(dir, `part-${index}.mp3`)
      const result = spawnSync(ffmpegPath!, [
        '-hide_banner', '-loglevel', 'error', '-f', 'lavfi',
        '-i', `sine=frequency=${440 + index * 220}:duration=${seconds}`,
        '-c:a', 'libmp3lame', '-b:a', '128k', '-y', filename,
      ])
      assert.equal(result.status, 0, result.stderr.toString())
      return readFileSync(filename)
    })
    const output = await finalizeMp3(parts, [
      { role: '主持人', text: '第一段' }, { role: '嘉宾', text: '第二段' },
    ], '测试节目')
    const filename = path.join(dir, 'final.mp3')
    writeFileSync(filename, output.audio)
    assert.ok(Math.abs(output.duration - 5) < 0.15)
    const probe = spawnSync(ffmpegPath!, ['-hide_banner', '-i', filename])
    assert.match(probe.stderr.toString(), /Duration:\s*00:00:05\./)
    assert.ok(output.timedScript[1].startMs >= 1900 && output.timedScript[1].startMs <= 2100)
    assert.ok(output.audio.includes(Buffer.from('USLT')))
    assert.ok(output.audio.includes(Buffer.from('SYLT')))
    assert.ok(output.audio.includes(Buffer.from('TIT2')))
    assert.equal(output.audio[3], 3)
    assert.ok(output.audio.includes(Buffer.from('测试节目', 'utf16le')))
    const metadata = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format_tags=title,artist,album,lyrics-zho', '-of', 'json', filename])
    assert.equal(metadata.status, 0, metadata.stderr.toString())
    const tags = JSON.parse(metadata.stdout.toString()).format.tags
    assert.equal(tags.title, '测试节目')
    assert.equal(tags.artist, '驿·声笺')
    assert.equal(tags.album, '驿·声笺')
    assert.match(tags['lyrics-zho'], /\[00:02\.0\d\]嘉宾: 第二段/)
    assert.match(tags['lyrics-zho'], /\[ar:驿·声笺\]/)
    assert.equal(embedScript(output.audio, output.timedScript, output.duration, '测试节目').length, output.audio.length)
    assert.match(toLrc(output.timedScript, '测试节目'), /\[00:02\.0\d\]嘉宾: 第二段/)
    const legacy = await normalizeExistingMp3(Buffer.concat(parts), [
      { role: '主持人', text: '第一段', startMs: 0 },
      { role: '嘉宾', text: '第二段', startMs: 2000 },
    ], 5, '旧音频')
    assert.ok(Math.abs(legacy.duration - 5) < 0.15)
    assert.ok(legacy.audio.includes(Buffer.from('旧音频', 'utf16le')))
    assert.ok(legacy.timedScript[1].startMs >= 1900 && legacy.timedScript[1].startMs <= 2100)
    process.stdout.write(`audio metadata and lyrics verified: ${output.duration.toFixed(2)} seconds\n`)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

main().catch(error => { console.error(error); process.exitCode = 1 })
