import { Suspense } from "react";
import TwSizeIndicator from "src/components/helper/TwSizeIndicator";
import {ThemeProvider} from "src/components/theme/ThemeContext";
import Header from "src/components/Header";
import Footer from "src/components/Footer";
import Sidebar from "src/components/shell/Sidebar";
import { Toaster } from "sonner";
import { AudioPlayerProvider } from "@/contexts/AudioPlayerContext";
import GlobalAudioPlayer from "@/components/GlobalAudioPlayer";

export default function Body({children, locale}) {
  return (
    <body className="min-h-screen bg-paper font-sans text-ink">
    <Toaster position="top-center" richColors />
    <TwSizeIndicator />
    <ThemeProvider>
      <AudioPlayerProvider>
        <div className="flex min-h-screen">
          <Suspense fallback={null}><Sidebar /></Suspense>
          <div className="flex min-w-0 flex-1 flex-col">
            <Header />
            <main className="flex-1">{children}</main>
            <Footer />
          </div>
        </div>
        {/* 全局音频播放器 */}
        <GlobalAudioPlayer />
      </AudioPlayerProvider>
    </ThemeProvider>

    {process.env.NEXT_PUBLIC_METRICA_ID && <div dangerouslySetInnerHTML={{
      __html: `<script type="text/javascript" > (function(m,e,t,r,i,k,a){m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)}; m[i].l=1*new Date(); for (var j = 0; j < document.scripts.length; j++) {if (document.scripts[j].src === r) { return; }} k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)}) (window, document, "script", "https://mc.yandex.ru/metrika/tag.js", "ym");
   ym(${process.env.NEXT_PUBLIC_METRICA_ID}, "init", { clickmap:true, trackLinks:true, accurateTrackBounce:true }); </script> <noscript><div><img src="https://mc.yandex.ru/watch/${process.env.NEXT_PUBLIC_METRICA_ID}" style="position:absolute; left:-9999px;" alt="" /></div></noscript>`
    }}></div>}

    {process.env.NEXT_PUBLIC_ANALYTICS_ID && <div dangerouslySetInnerHTML={{
      __html: `<!-- Google tag (gtag.js) --> <script async src="https://www.googletagmanager.com/gtag/js?id=${process.env.NEXT_PUBLIC_ANALYTICS_ID}"></script> <script> window.dataLayer = window.dataLayer || []; function gtag(){dataLayer.push(arguments);} gtag('js', new Date());
  gtag('config', '${process.env.NEXT_PUBLIC_ANALYTICS_ID}'); </script>`
    }}></div>}

    {process.env.NEXT_PUBLIC_CLARITY_ID && <div dangerouslySetInnerHTML={{
          __html: `<script type="text/javascript">
        (function(c,l,a,r,i,t,y){
            c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
            t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
            y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
        })(window, document, "clarity", "script", "${process.env.NEXT_PUBLIC_CLARITY_ID}");
    </script>`
        }}></div>}

    </body>
  )
}
