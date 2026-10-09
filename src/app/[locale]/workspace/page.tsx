import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/utils/user'
import WorkspaceConsole from '@/components/podcast/WorkspaceConsole'
export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const user = await getCurrentUser()
  if (!user.userEmail) redirect(`/${locale}/enter-code`)
  return (
    <WorkspaceConsole
      viewer={{
        isAdmin: user.isAdmin,
        isSuperAdmin: user.isSuperAdmin,
        teamAdminIds: user.teamAdminIds,
      }}
    />
  )
}
