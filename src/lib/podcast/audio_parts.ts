import axios from 'axios';
import { ScriptItem, VoiceOption } from './types';
import pLimit from 'p-limit';
import { AudioResult } from './types';
import { getAxiosInstance } from '@/utils/http';
import { getApiSetting } from '@/lib/settings';
import { finalizeMp3 } from './finalize_mp3';
import { describeApiFailure } from '@/lib/api-errors';
import { spawn } from 'child_process';
import { mkdtemp, readFile, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import path from 'path';
import ffmpegPath from 'ffmpeg-static';

export async function genVoiceMinimax(text: string, voiceOption: VoiceOption): Promise<AudioResult> {
    const [groupId, token] = await Promise.all([getApiSetting('MINIMAX_GROUP_ID'), getApiSetting('MINIMAX_TOKEN')]);
    if (!groupId || !token) throw new Error('MiniMax API is not configured');
    // China-only override (see voices/route.ts comment).
    const url = `https://api.minimaxi.com/v1/t2a_v2?GroupId=${groupId}`;

    const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
    };

    const payload = {
        model: 'speech-02-turbo',
        text: text,
        voice_setting: {
            speed: voiceOption.speed,
            vol: voiceOption.volume,
            voice_id: voiceOption.id
        },
        language_boost: 'auto',
    };

    const response = await axios.post(url, payload, { headers, validateStatus: () => true });
    if (response.status !== 200) {
        throw describeApiFailure(response.status, 'MiniMax TTS');
    }

    const data = response.data;
    let status: number;
    try {
        status = data.data.status;
    } catch {
        status = 0;
    }

    if (status !== 2) {
        const reason = String(data.base_resp?.status_msg || data.base_resp?.message || '未知错误');
        if (/quota|balance|insufficient|余额|额度|欠费|limit/i.test(reason)) {
            throw new Error('MiniMax TTS API 额度已用完，请更换自己的 Key 或联系管理员');
        }
        throw new Error(`MiniMax TTS 生成失败：${reason.slice(0, 160)}`);
    }

    const audioHex = data.data.audio;
    return {audio: Buffer.from(audioHex, 'hex'), format: 'mp3'};
}

export async function genVoiceFishAudio(text: string, voiceOption: VoiceOption): Promise<AudioResult> {
    const [token, model] = await Promise.all([getApiSetting('FISH_AUDIO_TOKEN'), getApiSetting('FISH_AUDIO_MODEL')]);
    if (!token) throw new Error('Fish Audio API Key 尚未配置');
    const url = 'https://api.fish.audio/v1/tts';
    const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'model': model || 's2.1-pro-free',
    };

    let prosody: any = null;
    if (voiceOption.speed != undefined) {
        prosody = {
            speed: voiceOption.speed,
        }
    }
    if (voiceOption.volume != undefined) {
        prosody = {
            volume: voiceOption.volume,
        }
    }

    const request: any = {
        text: text,
        chunk_length: 200,
        format: 'mp3',
        mp3_bitrate: 128,
        references: [],
        reference_id: voiceOption.id,
        normalize: true,
        latency: 'normal',
    };
    if (prosody) {
        request.prosody = prosody;
    }
    // console.log(JSON.stringify(request))
    // return Buffer.from([])

    const response = await getAxiosInstance().post(url, request, {
        headers,
        responseType: 'arraybuffer',
        validateStatus: () => true,
    });

    if (response.status !== 200) {
        throw describeApiFailure(response.status, 'Fish Audio TTS');
    }

    return {audio: Buffer.from(response.data), format: 'mp3'};
}

async function wavToMp3(audio: Buffer): Promise<Buffer> {
    const dir = await mkdtemp(path.join(tmpdir(), 'twocast-gemini-'));
    try {
        const input = path.join(dir, 'voice.wav');
        const output = path.join(dir, 'voice.mp3');
        await writeFile(input, audio);
        const binary = process.env.FFMPEG_PATH || (process.env.VERCEL === '1'
            ? path.join(process.cwd(), 'node_modules/ffmpeg-static/ffmpeg') : ffmpegPath);
        if (!binary) throw new Error('FFmpeg 不可用');
        await new Promise<void>((resolve, reject) => {
            const child = spawn(binary, ['-hide_banner', '-loglevel', 'error', '-y', '-i', input,
                '-c:a', 'libmp3lame', '-b:a', '128k', output]);
            let stderr = '';
            child.stderr.on('data', chunk => { stderr += String(chunk).slice(0, 300) });
            child.on('error', reject);
            child.on('close', code => code === 0 ? resolve() : reject(new Error(`Gemini 音频转换失败: ${stderr}`)));
        });
        return await readFile(output);
    } finally {
        await rm(dir, { recursive: true, force: true });
    }
}

export async function genVoiceGemini(text: string, voiceOption: VoiceOption): Promise<AudioResult> {
    const [token, model] = await Promise.all([getApiSetting('GEMINI_TTS_API_KEY'), getApiSetting('GEMINI_TTS_MODEL')]);
    if (!token) throw new Error('Gemini TTS API Key 尚未配置');
    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/interactions', {
        method: 'POST',
        headers: { 'x-goog-api-key': token, 'content-type': 'application/json' },
        body: JSON.stringify({ model: model || 'gemini-3.8-flash-lite-tts',
            input: [{ type: 'user_input', content: [{ type: 'text', text }] }],
            response_format: { type: 'audio' },
            generation_config: { speech_config: [{ voice: voiceOption.id }] },
        }),
    });
    if (!response.ok) throw describeApiFailure(response.status, 'Gemini TTS');
    const result = await response.json();
    const encoded = result.steps?.flatMap((step: { content?: { data?: string }[] }) => step.content || [])
        .find((part: { data?: string }) => part.data)?.data;
    if (!encoded) throw new Error('Gemini TTS 未返回音频');
    return { audio: await wavToMp3(Buffer.from(encoded, 'base64')), format: 'mp3' };
}

export interface GenPartsParams {
    concurrency: number
    items: ScriptItem[]
    genFn: (text: string, voiceOption: VoiceOption) => Promise<AudioResult>
    voiceOption_1: VoiceOption
    voiceOption_2: VoiceOption
}
export async function genParts(params: GenPartsParams): Promise<AudioResult> {
    // 使用 p-limit 控制并发，最多5个任务同时运行
    console.log(`[genParts] concurrency=${params.concurrency}`)
    const limit = pLimit(params.concurrency || 1);
    let audios: AudioResult[] = Array(params.items.length).fill(null);

    const tasks = params.items.map((item, idx) =>
        limit(async () => {
            const text = item.text?.trim();
            if (!text) {
                return;
            }
            const voiceOpt = idx % 2 === 0 ? params.voiceOption_1 : params.voiceOption_2;
            // console.log(`[genParts] id=${idx}`)
            const audio = await params.genFn(text, voiceOpt);
            audios[idx] = audio;
        })
    );

    await Promise.all(tasks);

    const valid = audios.map((audio, index) => ({ audio, line: params.items[index] })).filter(item => item.audio)
    const rendered = await finalizeMp3(valid.map(item => item.audio.audio), valid.map(item => item.line))
    return { audio: rendered.audio, format: 'mp3', duration: rendered.duration, timedScript: rendered.timedScript };
}
