import { NextRequest } from 'next/server'
import { loadEpisodeList } from '@/lib/podcast/list'
import { getCurrentUser } from '@/utils/user'
import { respData, respErr } from '@/utils/resp'

export async function GET(req: NextRequest) {
  const startedAt = performance.now()
  const viewer = await getCurrentUser()
  const authAt = performance.now()
  if (!viewer.userEmail) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const searchParams = req.nextUrl.searchParams
  const page = Math.max(1, Number(searchParams.get('page') || 1) || 1)
  const pageSize = Math.min(50, Math.max(1, Number(searchParams.get('page_size') || 10) || 10))
  const status = searchParams.get('status') || ''
  const search = (searchParams.get('search') || '').trim().slice(0, 80)
  const folder = (searchParams.get('folder') || '').slice(0, 255)
  const scope = searchParams.get('scope') || ''
  if (folder && (!folder.startsWith('/') || !folder.endsWith('/'))) return respErr('目录格式无效')

  const data = await loadEpisodeList(viewer, { page, pageSize, status, search, folder, scope })
  const queriedAt = performance.now()
  const response = respData(data)
  response.headers.set('Server-Timing', `auth;dur=${(authAt - startedAt).toFixed(1)}, db;dur=${(queriedAt - authAt).toFixed(1)}, render;dur=${(performance.now() - queriedAt).toFixed(1)}`)
  return response
}
