import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/utils/user'
import FeedbackConsole from '@/components/feedback/FeedbackConsole'
export default async function Page() {
  const user = await getCurrentUser()
  if (!user.userEmail) redirect('/enter-code')
  return <FeedbackConsole isAdmin={user.isAdmin} />
}
