import { getAxiosInstance } from "@/utils/http";
import { respSuccess } from "@/utils/resp";
import { getSetting } from '@/lib/settings';
import { getUserSetting } from '@/lib/settings';
import { availableTtsAccess } from '@/lib/api-access';
import { getCurrentUser } from '@/utils/user';

export async function GET() {
    const user = await getCurrentUser()
    if (!user.userEmail) return new Response('Unauthorized', { status: 401 })
    const ret = {
    }
    const access = await availableTtsAccess(user)
    if (process.env.MINIMAX_ENABLED === '1' || (access.source === 'own' || access.source === 'member') && !access.error) {
        const token = access.error ? '' : access.source === 'own'
            ? await getUserSetting(user.userId, 'MINIMAX_TOKEN') : access.source === 'member' && access.ownerUserId
              ? await getUserSetting(access.ownerUserId, 'MINIMAX_TOKEN') : await getSetting('MINIMAX_TOKEN')
        try { ret['minimaxi'] = await getMinimaxVoices(token) }
        catch (error) { console.warn('MiniMax voice list unavailable:', error) }
    }
    ret['gemini'] = geminiVoices
    return respSuccess(ret)
}

async function getMinimaxVoices(token: string) {
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
