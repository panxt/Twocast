import { ListPanel } from "@/components/podcast/ListPanel";
import { UserPanel } from "@/components/podcast/UserPanel";
import { Explore } from "@/components/saas/Explore";
import { Faq } from "@/components/saas/Faq";
import { Features } from "@/components/saas/Features";
import { HowTo } from "@/components/saas/HowTo";
import { Introduction } from "@/components/saas/Introduction";
import { createTranslation } from "@/i18n/server";
import { LocaleTypes } from "@/i18n/settings";

type HomeProps = {
  params: Promise<{ locale: LocaleTypes }>
}

export default async function Page({ params }: HomeProps) {
  const { locale } = await params
  const { t } = await createTranslation(locale, "home");
  return (
    <>
      <UserPanel />
      <Explore />
      <Introduction />
      <HowTo />
      <Features />
      <Faq />

      <div className="flex items-center space-x-2 flex-wrap text-gray-500 dark:text-gray-400 justify-center text-sm bg-gray-100 dark:bg-gray-800 p-2">
        {/* 友链放这里 */}
        {/* {(await getFriendLinks()).map((link) => (
          <span dangerouslySetInnerHTML={{ __html: link.link }} key={link.id} />
        ))} */}
      </div>
    </>
  );
}
