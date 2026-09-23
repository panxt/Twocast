import { getAxiosInstance } from "@/utils/http";
import { getCache, setCache } from "@/utils/redis";
import { respSuccess } from "@/utils/resp";
import { NextRequest } from "next/server";
import { getSetting } from '@/lib/settings';
import { getCurrentUser } from '@/utils/user';

export async function GET(req: NextRequest) {
    if (!(await getCurrentUser()).userEmail) return new Response('Unauthorized', { status: 401 })
    const languages = req.nextUrl.searchParams.get('languages')?.split(',') || []
    const ret = {
    }
    if (process.env.MINIMAX_ENABLED === '1') {
        ret['minimaxi'] = await getMinimaxVoices()
    }
    if (process.env.GEMINI_ENABLED === '1') {
        ret['gemini'] = geminiVoices
    }
    if (process.env.FISH_AUDIO_ENABLED === '1') {
        ret['fish_audio'] = await getFishAudioVoices(languages)
    }
    return respSuccess(ret)
}

async function getFishAudioVoices(languages: string[] = [], page_size: number = 100) {
    // api doc: https://docs.fish.audio/api-reference/endpoint/model/list-models#parameter-language
    const cacheKey = 'fish_audio_voices_' + languages.join(',') + '_' + page_size
    const cache = await getCache(cacheKey)
    if (cache) {
        return cache
    }
    const u = new URL('https://api.fish.audio/model')
    const params = {
        // 'language': languages.join(','),
        // 'title_language': languages.join(','),
        page_size: page_size.toString(),
    }
    if (languages.length > 0) {
        params['language'] = languages.join(',')
        params['title_language'] = languages.join(',')
    }
    u.search = new URLSearchParams(params).toString()
    const headers = {
        'Authorization': `Bearer ${process.env.FISH_AUDIO_TOKEN}`
    }
    console.log(u.toString())
    const response = await getAxiosInstance().get(u.toString(), {
        headers: headers,
        timeout: 10000,
    })
    if (response.status != 200) {
        throw new Error(`Failed to get fish audio voices, status: ${response.status}, body: ${response.data?.slice(0, 100)}`)
    }
    const jd = response.data
    // console.log(jd.items[0])
    const ret = jd.items.map(v => {
        const lang = v.languages.join('-')
        return {
            id: v._id,
            name: lang + '-' + v.title,
            description: v.description,
            sample: v.samples[0]?.audio
        }
    })
    await setCache(cacheKey, ret, 60 * 60 * 24)
    return ret
}

async function getMinimaxVoices() {
    const token = await getSetting('MINIMAX_TOKEN')
    if (!token) return []

    // China-only override: original code used api.minimax.chat (overseas), but the
    // user's network transparently proxies overseas domains to localhost, causing
    // "400 The plain HTTP request was sent to HTTPS port". The China endpoint
    // api.minimaxi.com is reachable and accepts the same Bearer token.
    const url = 'https://api.minimaxi.com/v1/get_voice'
    const headers = {
        'authority': 'api.minimaxi.com',
        'content-type': 'application/json',
        'Authorization': `Bearer ${token}`
    }
    // console.log('process.env.MINIMAX_TOKEN', process.env.MINIMAX_TOKEN)

    const data = {
        'voice_type': 'all'
    }

    const response = await getAxiosInstance().post(url, data, {
        headers: headers,
        timeout: 10000,
    })
    if (response.status != 200) {
        throw new Error(`Failed to get minimaxi voices, status: ${response.status}, body: ${response.data?.slice(0, 100)}`)
    }
    const jd = response.data
    // console.log(jd)
    const ret = jd.system_voice.map(v => {
        return {
            id: v.voice_id,
            name: v.voice_name,
            description: '',
        }
    })
    return ret
}

const geminiVoices = [
    { "id": "Zephyr", "name": "Zephyr", "description": "Bright", },
    { "id": "Puck", "name": "Puck", "description": "Upbeat", },
    { "id": "Charon", "name": "Charon", "description": "Informative", },

    { "id": "Kore", "name": "Kore", "description": "Firm", },
    { "id": "Fenrir", "name": "Fenrir", "description": "Excitable", },
    { "id": "Leda", "name": "Leda", "description": "Youthful", },

    { "id": "Orus", "name": "Orus", "description": "Firm", },
    { "id": "Aoede", "name": "Aoede", "description": "Breezy", },
    { "id": "Callirrhoe", "name": "Callirrhoe", "description": "Easy-going", },

    { "id": "Autonoe", "name": "Autonoe", "description": "Bright", },
    { "id": "Enceladus", "name": "Enceladus", "description": "Breathy", },
    { "id": "Iapetus", "name": "Iapetus", "description": "Clear", },

    { "id": "Umbriel", "name": "Umbriel", "description": "Easy-going", },
    { "id": "Algieba", "name": "Algieba", "description": "Smooth", },
    { "id": "Despina", "name": "Despina", "description": "Smooth", },

    { "id": "Erinome", "name": "Erinome", "description": "Clear", },
    { "id": "Algenib", "name": "Algenib", "description": "Gravelly", },
    { "id": "Rasalgethi", "name": "Rasalgethi", "description": "Informative", },

    { "id": "Laomedeia", "name": "Laomedeia", "description": "Upbeat", },
    { "id": "Achernar", "name": "Achernar", "description": "Soft", },
    { "id": "Alnilam", "name": "Alnilam", "description": "Firm", },

    { "id": "Schedar", "name": "Schedar", "description": "Even", },
    { "id": "Gacrux", "name": "Gacrux", "description": "Mature", },
    { "id": "Pulcherrima", "name": "Pulcherrima", "description": "Forward", },

    { "id": "Achird", "name": "Achird", "description": "Friendly", },
    { "id": "Zubenelgenubi", "name": "Zubenelgenubi", "description": "Casual", },
    { "id": "Vindemiatrix", "name": "Vindemiatrix", "description": "Gentle", },

    { "id": "Sadachbia", "name": "Sadachbia", "description": "Lively", },
    { "id": "Sadaltager", "name": "Sadaltager", "description": "Knowledgeable", },
    { "id": "Sulafat", "name": "Sulafat", "description": "Warm", },
]
