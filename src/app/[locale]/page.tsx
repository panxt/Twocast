import { UserPanel } from "@/components/podcast/UserPanel";
import { LocaleTypes } from "@/i18n/settings";

type HomeProps = {
  params: Promise<{ locale: LocaleTypes }>
}

export default async function Page({ params }: HomeProps) {
  await params
  return <UserPanel />
}
