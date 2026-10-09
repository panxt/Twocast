export type AccountRole = 'member' | 'admin' | 'super_admin'
export function canManageAccount(
  viewer: { isAdmin: boolean; isSuperAdmin?: boolean; userId?: number },
  target: { id: number; role: string }
) {
  if (!viewer.isAdmin) return false
  if (target.role === 'super_admin')
    return Boolean(viewer.isSuperAdmin && viewer.userId === target.id)
  return Boolean(viewer.isSuperAdmin || target.role === 'member')
}
