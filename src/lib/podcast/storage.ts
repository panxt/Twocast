import 'server-only'
import fs from 'fs/promises'
import path from 'path'

const BUCKET = 'podcast-audio'
const UPLOAD_BUCKET = 'podcast-files'

function storageConfig() {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, '')
  const key = process.env.SUPABASE_SECRET_KEY
  if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_SECRET_KEY are required for audio storage')
  return { url, key }
}

export async function storeAudio(filename: string, audio: Buffer): Promise<string> {
  if (process.env.NODE_ENV !== 'production' && !process.env.SUPABASE_URL) {
    const dir = path.join(process.cwd(), 'public', 'assets', 'audio')
    await fs.mkdir(dir, { recursive: true })
    await fs.writeFile(path.join(dir, filename), audio)
    return `/assets/audio/${filename}`
  }
  const { url, key } = storageConfig()
  const response = await fetch(`${url}/storage/v1/object/${BUCKET}/${encodeURIComponent(filename)}`, {
    method: 'POST',
    headers: { authorization: `Bearer ${key}`, apikey: key, 'content-type': 'audio/mpeg', 'x-upsert': 'true' },
    body: new Uint8Array(audio),
  })
  if (!response.ok) throw new Error(`Audio upload failed (${response.status}): ${(await response.text()).slice(0, 200)}`)
  return `supabase:${filename}`
}

export async function storeUpload(filename: string, bytes: Buffer, contentType: string): Promise<string> {
  if (process.env.NODE_ENV !== 'production' && !process.env.SUPABASE_URL) {
    const dir = path.join(process.cwd(), 'private', 'uploads')
    await fs.mkdir(dir, { recursive: true })
    await fs.writeFile(path.join(dir, filename), bytes)
    return `local-upload:${filename}`
  }
  const { url, key } = storageConfig()
  const response = await fetch(`${url}/storage/v1/object/${UPLOAD_BUCKET}/${encodeURIComponent(filename)}`, {
    method: 'POST',
    headers: { authorization: `Bearer ${key}`, apikey: key, 'content-type': contentType },
    body: new Uint8Array(bytes),
  })
  if (!response.ok) throw new Error(`File upload failed (${response.status})`)
  return `supabase-upload:${filename}`
}

export async function getAudioUrl(location: string, downloadName?: string): Promise<string> {
  if (!location?.startsWith('supabase:')) return location
  const { url, key } = storageConfig()
  const filename = location.slice('supabase:'.length)
  const response = await fetch(`${url}/storage/v1/object/sign/${BUCKET}/${encodeURIComponent(filename)}`, {
    method: 'POST',
    headers: { authorization: `Bearer ${key}`, apikey: key, 'content-type': 'application/json' },
    body: JSON.stringify({ expiresIn: 24 * 60 * 60 }),
  })
  if (!response.ok) throw new Error(`Audio URL signing failed (${response.status})`)
  const data = await response.json()
  const signed = data.signedURL.startsWith('http')
    ? data.signedURL
    : new URL(`/storage/v1${data.signedURL}`, url).toString()
  if (!downloadName) return signed
  const downloadUrl = new URL(signed)
  downloadUrl.searchParams.set('download', downloadName)
  return downloadUrl.toString()
}

export async function readAudio(filename: string): Promise<Buffer> {
  const { url, key } = storageConfig()
  const response = await fetch(`${url}/storage/v1/object/authenticated/${BUCKET}/${encodeURIComponent(filename)}`, {
    headers: { authorization: `Bearer ${key}`, apikey: key },
  })
  if (!response.ok) throw new Error(`Audio download failed (${response.status})`)
  return Buffer.from(await response.arrayBuffer())
}

export async function removeAudio(files: string[]): Promise<void> {
  if (!files.length) return
  const { url, key } = storageConfig()
  const response = await fetch(`${url}/storage/v1/object/${BUCKET}`, {
    method: 'DELETE',
    headers: { authorization: `Bearer ${key}`, apikey: key, 'content-type': 'application/json' },
    body: JSON.stringify({ prefixes: files }),
  })
  if (!response.ok) throw new Error(`Audio cleanup failed (${response.status})`)
}

export async function removeUpload(location: string): Promise<void> {
  if (location.startsWith('local-upload:')) {
    await fs.rm(path.join(process.cwd(), 'private', 'uploads', location.slice(13)), { force: true })
    return
  }
  if (!location.startsWith('supabase-upload:')) return
  const { url, key } = storageConfig()
  const response = await fetch(`${url}/storage/v1/object/${UPLOAD_BUCKET}`, {
    method: 'DELETE',
    headers: { authorization: `Bearer ${key}`, apikey: key, 'content-type': 'application/json' },
    body: JSON.stringify({ prefixes: [location.slice('supabase-upload:'.length)] }),
  })
  if (!response.ok) throw new Error(`File cleanup failed (${response.status})`)
}

export async function getUploadUrl(location: string, downloadName: string): Promise<string> {
  if (!location.startsWith('supabase-upload:')) throw new Error('This upload is stored locally')
  const { url, key } = storageConfig()
  const filename = location.slice('supabase-upload:'.length)
  const response = await fetch(`${url}/storage/v1/object/sign/${UPLOAD_BUCKET}/${encodeURIComponent(filename)}`, {
    method: 'POST', headers: { authorization: `Bearer ${key}`, apikey: key, 'content-type': 'application/json' },
    body: JSON.stringify({ expiresIn: 60 * 60 }),
  })
  if (!response.ok) throw new Error(`File signing failed (${response.status})`)
  const data = await response.json()
  const signed = new URL(data.signedURL.startsWith('http') ? data.signedURL : `/storage/v1${data.signedURL}`, url)
  signed.searchParams.set('download', downloadName.replace(/[\\/:*?"<>|\r\n]/g, ' ').slice(0, 100))
  return signed.toString()
}

export async function readLocalUpload(location: string): Promise<Buffer> {
  if (!location.startsWith('local-upload:')) throw new Error('Not a local upload')
  return fs.readFile(path.join(process.cwd(), 'private', 'uploads', location.slice('local-upload:'.length)))
}

// ---------------------------------------------------------------------------
// 节目封面：私有桶 podcast-covers；本地开发落到 public/assets/covers。
// ---------------------------------------------------------------------------
const COVER_BUCKET = 'podcast-covers'

export async function storeCover(filename: string, bytes: Buffer, contentType: string): Promise<string> {
  if (process.env.NODE_ENV !== 'production' && !process.env.SUPABASE_URL) {
    const dir = path.join(process.cwd(), 'public', 'assets', 'covers')
    await fs.mkdir(dir, { recursive: true })
    await fs.writeFile(path.join(dir, filename), bytes)
    return `/assets/covers/${filename}`
  }
  const { url, key } = storageConfig()
  const response = await fetch(`${url}/storage/v1/object/${COVER_BUCKET}/${encodeURIComponent(filename)}`, {
    method: 'POST',
    headers: { authorization: `Bearer ${key}`, apikey: key, 'content-type': contentType, 'x-upsert': 'true' },
    body: new Uint8Array(bytes),
  })
  if (!response.ok) throw new Error(`Cover upload failed (${response.status}): ${(await response.text()).slice(0, 200)}`)
  return `supabase-cover:${filename}`
}

export async function getCoverUrl(location: string): Promise<string> {
  if (!location.startsWith('supabase-cover:')) return location
  const { url, key } = storageConfig()
  const filename = location.slice('supabase-cover:'.length)
  const response = await fetch(`${url}/storage/v1/object/sign/${COVER_BUCKET}/${encodeURIComponent(filename)}`, {
    method: 'POST',
    headers: { authorization: `Bearer ${key}`, apikey: key, 'content-type': 'application/json' },
    body: JSON.stringify({ expiresIn: 24 * 60 * 60 }),
  })
  if (!response.ok) throw new Error(`Cover URL signing failed (${response.status})`)
  const data = await response.json()
  return data.signedURL.startsWith('http') ? data.signedURL : new URL(`/storage/v1${data.signedURL}`, url).toString()
}

export async function removeCover(location: string): Promise<void> {
  if (location.startsWith('/assets/covers/')) {
    await fs.rm(path.join(process.cwd(), 'public', location), { force: true })
    return
  }
  if (!location.startsWith('supabase-cover:')) return
  const { url, key } = storageConfig()
  const response = await fetch(`${url}/storage/v1/object/${COVER_BUCKET}`, {
    method: 'DELETE',
    headers: { authorization: `Bearer ${key}`, apikey: key, 'content-type': 'application/json' },
    body: JSON.stringify({ prefixes: [location.slice('supabase-cover:'.length)] }),
  })
  if (!response.ok) throw new Error(`Cover cleanup failed (${response.status})`)
}
