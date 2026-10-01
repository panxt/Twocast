'use client'

const templates = [
  {
    name: 'MiniMax 国内站',
    url: 'https://api.minimax.cn/v1/chat/completions',
    model: 'MiniMax-M2.7',
  },
  {
    name: 'MiniMax 国际站',
    url: 'https://api.minimax.io/v1/chat/completions',
    model: 'MiniMax-M2.7',
  },
]

export const MODEL_FIELD_HELP: Record<string, string> = {
  LLM_CHAT_URL:
    '填写完整请求地址，需包含 /chat/completions；不是控制台网址，也不是仅有 /v1 的 Base URL。',
  LLM_CHAT_MODEL: '填写服务商模型 ID（区分大小写），模型需支持聊天接口和 JSON 输出。',
  LLM_API_KEY: '粘贴该服务商的 API Key 本身，不要加 Bearer 前缀。用于大纲和脚本。',
  LLM_SEARCH_URL:
    '仅按主题生成时需要。当前只为 api.x.ai 自动启用联网搜索，普通聊天接口不能代替搜索。',
  LLM_SEARCH_MODEL: '需使用搜索服务支持的模型 ID；上传文件、粘贴正文和普通链接无需此项。',
  LLM_SEARCH_API_KEY: '搜索服务的 API Key，可以与聊天服务不同。',
  MINIMAX_GROUP_ID: '从 MiniMax 国内站账户信息复制 Group ID；当前语音服务接入国内站。',
  MINIMAX_TOKEN:
    '用于 MiniMax 国内站语音与默认 AI 封面；聊天 Key 请另填到聊天 API Key。套餐与能力权限以平台账户为准。',
  ELEVENLABS_API_KEY:
    '从 ElevenLabs 控制台创建 Key，需具有语音生成权限。音色 ID 可在创建节目时自行填写。',
  ELEVENLABS_MODEL: '默认 eleven_multilingual_v2，可填写账户支持的 TTS 模型 ID。',
  FISH_AUDIO_TOKEN: '使用 Fish Audio 时填写该平台 Key，创建节目时也要选择 Fish Audio。',
  FISH_AUDIO_MODEL: '可选模型：s1、s2-pro、s2.1-pro、s2.1-pro-free；实际可用性取决于账户权限。',
  GEMINI_TTS_API_KEY: '选择 Gemini 语音或 Gemini 封面时使用；不同能力可能需要单独开通权限。',
  GEMINI_TTS_MODEL: '只能填写站内支持的语音模型；留空采用字段标题中的默认值。',
  GEMINI_IMAGE_MODEL: '仅选择 Gemini 生成封面时使用；默认封面使用 MiniMax。',
}

export function ModelConfigGuide({
  onApply,
}: {
  onApply: (values: Record<string, string>) => void
}) {
  return (
    <details className="rounded-control border border-rule bg-paper p-3 text-sm text-ink-soft">
      <summary className="cursor-pointer font-semibold text-ink">
        第一次配置？查看 MiniMax 示例
      </summary>
      <div className="mt-3 flex flex-col gap-3 leading-6">
        <p>
          先配置聊天接口 URL、聊天模型和聊天 API
          Key，用于把资料整理成脚本；再配置一种语音服务，把脚本转成音频。两者可以选择不同服务商。
        </p>
        {templates.map((template) => (
          <div
            key={template.name}
            className="flex flex-col gap-1 rounded-control border border-rule bg-sheet p-3"
          >
            <strong className="text-ink">{template.name}聊天示例</strong>
            <code className="break-all text-xs">{template.url}</code>
            <span>模型示例：{template.model}，请按账户可用模型调整。</span>
            <button
              type="button"
              onClick={() =>
                onApply({ LLM_CHAT_URL: template.url, LLM_CHAT_MODEL: template.model })
              }
              className="ys-btn-sm ys-btn-secondary self-start"
            >
              填入空白的聊天字段
            </button>
          </div>
        ))}
        <p>
          示例只填地址和模型，不填密钥、不覆盖已有值。请使用对应国内站或国际站的
          Key；填好后点击「保存配置」。建议先用一小段正文生成，确认账户和模型有调用权限。
        </p>
        <p>
          MiniMax 语音需填写国内站 API Key 和 Group
          ID；无需把语音模型名填进聊天模型。聊天服务支持已接入的 OpenAI
          兼容接口，其他服务商也按「完整 URL + 模型 ID + 对应 Key」填写。搜索项可以先留空。
        </p>
        <p>
          普通用户可用域名：api.minimax.cn、api.minimaxi.com、api.minimax.io、api.openai.com、openrouter.ai、api.deepseek.com、api.x.ai、api.moonshot.cn、dashscope.aliyuncs.com、generativelanguage.googleapis.com。域名获准不表示所有接口协议都已接入；Gemini
          原生聊天接口目前不能直接填入聊天 URL。
        </p>
        <p>
          <a
            href="https://platform.minimax.cn/docs/api-reference/text-openai-api"
            target="_blank"
            rel="noreferrer"
            className="underline"
          >
            MiniMax 国内站文档
          </a>{' '}
          ·{' '}
          <a
            href="https://platform.minimax.io/docs/api-reference/text-openai-api"
            target="_blank"
            rel="noreferrer"
            className="underline"
          >
            国际站文档
          </a>
        </p>
      </div>
    </details>
  )
}
