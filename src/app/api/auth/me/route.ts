import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/utils/user'

export async function GET() {
  const user = await getCurrentUser()
  return NextResponse.json({ authenticated: Boolean(user.userEmail), isAdmin: user.isAdmin,
    isTeamMember: user.isTeamMember, userId: user.userId, displayName: user.displayName })
}
