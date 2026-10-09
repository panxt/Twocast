import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/utils/user'

export async function GET() {
  const startedAt = performance.now()
  const user = await getCurrentUser()
  const response = NextResponse.json({
    authenticated: Boolean(user.userEmail),
    isAdmin: user.isAdmin,
    isSuperAdmin: user.isSuperAdmin,
    isTeamMember: user.isTeamMember,
    hasTeams: user.teamIds.length > 0,
    teamAdminIds: user.teamAdminIds,
    userId: user.userId,
    displayName: user.displayName,
  })
  response.headers.set('Cache-Control', 'private, no-store')
  response.headers.set('Server-Timing', `auth;dur=${(performance.now() - startedAt).toFixed(1)}`)
  return response
}
