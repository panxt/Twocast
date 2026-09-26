import { Suspense } from 'react'
import { UserPanel } from "@/components/podcast/UserPanel";
import { LocaleTypes } from "@/i18n/settings";
import { loadEpisodeList } from '@/lib/podcast/list'
import { getCurrentUser } from '@/utils/user'
import { redirect } from 'next/navigation'

type HomeProps = {
  params: Promise<{ locale: LocaleTypes }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) || ''

export default async function Page({ params, searchParams }: HomeProps) {
  await params
  const query = await searchParams
  const viewer = await getCurrentUser()
  if (!viewer.userEmail) redirect('/zh/enter-code')
  const filters = { scope: first(query.scope), folder: first(query.folder), status: first(query.status) }
  const initialList = await loadEpisodeList(viewer, {
    page: 1, pageSize: 15, status: filters.status || 'all', search: '', folder: filters.folder, scope: filters.scope,
  })
  return <Suspense fallback={null}><UserPanel initialList={initialList} initialFilters={filters} /></Suspense>
}
