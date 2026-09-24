import { NextRequest, NextResponse } from 'next/server'
import { count } from 'drizzle-orm'
import { getDb } from '@/db/db'
import { tasksTable } from '@/db/schema'
import { getCurrentUser } from '@/utils/user'
import { taskScopeWhere } from '@/lib/podcast/scope'

export async function GET(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user.userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const scope = request.nextUrl.searchParams.get('scope') || (user.isAdmin ? 'all' : user.isTeamMember ? 'team' : 'mine')
  const rows = await getDb().select({ path: tasksTable.folderPath, episodes: count() })
    .from(tasksTable).where(taskScopeWhere(user, scope)).groupBy(tasksTable.folderPath)
  const counts = new Map<string, number>()
  for (const row of rows) {
    const segments = row.path.split('/').filter(Boolean)
    for (let depth = 0; depth <= segments.length; depth++) {
      const path = depth ? `/${segments.slice(0, depth).join('/')}/` : '/'
      counts.set(path, (counts.get(path) || 0) + row.episodes)
    }
  }
  const folders = [...counts].filter(([path]) => path !== '/').map(([path, episodes]) => {
    const segments = path.split('/').filter(Boolean)
    return { path, label: segments.at(-1) || '', depth: segments.length - 1, episodes }
  }).sort((a, b) => a.path.localeCompare(b.path, 'zh-Hans-CN'))
  return NextResponse.json({ folders })
}
