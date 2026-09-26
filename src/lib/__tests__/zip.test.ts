import { buildStoredZip, crc32 } from '../zip'

// 按 ZIP 规范读回中央目录与本地文件头，不依赖系统 unzip（其在无 UTF-8 locale 的环境下会拒绝中文文件名）。
function readEntries(zip: Buffer) {
  const eocd = zip.length - 22
  expect(zip.readUInt32LE(eocd)).toBe(0x06054b50)
  const count = zip.readUInt16LE(eocd + 10)
  let cursor = zip.readUInt32LE(eocd + 16)
  const entries: { name: string; data: Buffer; crc: number; flags: number }[] = []
  for (let i = 0; i < count; i++) {
    expect(zip.readUInt32LE(cursor)).toBe(0x02014b50)
    const flags = zip.readUInt16LE(cursor + 8)
    const crc = zip.readUInt32LE(cursor + 16)
    const size = zip.readUInt32LE(cursor + 20)
    const nameLength = zip.readUInt16LE(cursor + 28)
    const extraLength = zip.readUInt16LE(cursor + 30)
    const commentLength = zip.readUInt16LE(cursor + 32)
    const localOffset = zip.readUInt32LE(cursor + 42)
    const name = zip.toString('utf8', cursor + 46, cursor + 46 + nameLength)
    expect(zip.readUInt32LE(localOffset)).toBe(0x04034b50)
    expect(zip.readUInt16LE(localOffset + 8)).toBe(0) // stored
    const localNameLength = zip.readUInt16LE(localOffset + 26)
    const localExtraLength = zip.readUInt16LE(localOffset + 28)
    const dataStart = localOffset + 30 + localNameLength + localExtraLength
    entries.push({ name, crc, flags, data: zip.subarray(dataStart, dataStart + size) })
    cursor += 46 + nameLength + extraLength + commentLength
  }
  return entries
}

describe('stored zip bundle', () => {
  it('computes the standard CRC-32', () => {
    expect(crc32(Buffer.from('123456789', 'ascii')).toString(16)).toBe('cbf43926')
    expect(crc32(Buffer.alloc(0))).toBe(0)
  })

  it('keeps the MP3 and the LRC under the same UTF-8 basename with matching checksums', () => {
    const mp3 = Buffer.from([0xff, 0xfb, 0x90, 0x00, 1, 2, 3, 4, 5])
    const lrc = '[ti:海外仓 对账]\n[00:00.00]主持人: 大家好\n'
    const zip = buildStoredZip([
      { name: '海外仓 对账.mp3', data: mp3 },
      { name: '海外仓 对账.lrc', data: Buffer.from(lrc, 'utf8') },
    ], new Date(2026, 8, 26, 10, 30, 0))
    const entries = readEntries(zip)
    expect(entries.map(entry => entry.name)).toEqual(['海外仓 对账.mp3', '海外仓 对账.lrc'])
    expect(entries[0].data.equals(mp3)).toBe(true)
    expect(entries[1].data.toString('utf8')).toBe(lrc)
    for (const entry of entries) {
      expect(entry.flags & 0x0800).toBe(0x0800)
      expect(entry.crc).toBe(crc32(entry.data))
    }
  })
})
