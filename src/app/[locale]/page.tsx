import { UserPanel } from "@/components/podcast/UserPanel";
import { LocaleTypes } from "@/i18n/settings";
import { loadEpisodeList } from '@/lib/podcast/list'
import { getCurrentUser } from '@/utils/user'
import { redirect } from 'next/navigation'

type HomeProps = {
  params: Promise<{ locale: LocaleTypes }>
}

export default async function Page({ params }: HomeProps) {
  await params
  const viewer = await getCurrentUser()
  if (!viewer.userEmail) redirect('/zh/enter-code')
  const initialList = await loadEpisodeList(viewer, {
    page: 1, pageSize: 15, status: 'all', search: '', folder: '', scope: '',
  })
  return <UserPanel initialList={initialList} />
}
