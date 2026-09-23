# Twocast 私测版部署到 Vercel

此分支把生成任务交给 Vercel Workflow。Next.js 页面与 API 部署到 Vercel；Postgres 和私有音频桶使用独立 Supabase 项目。生产环境不需要 Redis、Docker、textract API 或 ffmpeg API：文件上传暂未开放，音频合成使用随应用打包的 `ffmpeg-static`。目前生产生成仅支持 MiniMax TTS；主题、链接和长文本输入可用。搜索型主题仍需配置 LLM 搜索接口。

## 已创建的资源

- Supabase 项目：`twocast-private-beta`（`acxuwbnwlezuutnaqlcs`，新加坡区域）
- 数据表：`tasks`、`invite_codes`、`invite_sessions`、`app_settings`
- 私有 Storage 桶：`podcast-audio`
- 应用数据库角色：`twocast_app`，仅授权这四张表；数据库密码只保存在本机忽略跟踪的 `.env.vercel.local` 中

数据库结构在 `supabase/migrations/20260923142151_initial_twocast_private_beta.sql`。在其他 Supabase 项目复用时，迁移后需要单独创建一个受限数据库角色，并为这四张表添加该角色的 RLS 策略；不要让 Web 应用使用 `postgres` 管理员账户。音频桶保持私有，应用只在服务端使用 Supabase secret key，并向登录用户签发短期音频 URL。

## Vercel 环境变量

参考 `.env.vercel.example`。必须在 Vercel 的 Production 和 Preview 环境各自配置：

| 变量 | 用途 |
| --- | --- |
| `DATABASE_URL` | Supabase transaction pooler，用户名 `twocast_app.<project-ref>`，连接串需 `sslmode=require` |
| `SUPABASE_URL` | 项目的 API URL |
| `SUPABASE_SECRET_KEY` | 项目 API Keys 页面中的旧版 `service_role` JWT，供 Storage REST 使用；不要使用 publishable/anon key |
| `BOOTSTRAP_ADMIN_CODE` | 管理员首次登录码，建议 `openssl rand -hex 24` |
| `SETTINGS_ENCRYPTION_KEY` | 加密管理后台保存的 API Key，使用 `openssl rand -base64 32` 生成，之后保持不变 |
| `NEXT_PUBLIC_SITE_URL` | 实际部署地址，例如 `https://<project>.vercel.app` |
| `NEXT_PUBLIC_VERCEL_BETA`、`INVITE_REQUIRED` | 均设为 `1` |
| `MINIMAX_ENABLED`、`FISH_AUDIO_ENABLED`、`GEMINI_ENABLED` | 分别设为 `1`、`0`、`0` |

`DATABASE_URL`、`SUPABASE_SECRET_KEY`、管理员码及加密密钥不得提交到 Git。当前本机 `.env.vercel.local` 已保存这些值与预设部署 URL，且已被 Git 忽略。若实际 Vercel 域名不同，应同时更新本机和 Vercel 的 `NEXT_PUBLIC_SITE_URL`，然后重新部署。

## 部署顺序

1. 将此分支推到自己的 GitHub fork，并在 Vercel 导入 fork。框架选 Next.js、根目录选仓库根目录、Node.js 选 24.x。构建命令使用项目的 `yarn build`。工作流插件会自动生成 Workflow 路由。
2. 配置上述 Vercel 环境变量；在 Supabase 项目 Settings → API Keys 复制旧版 `service_role` key 至 Vercel。保存后重新部署。
3. 打开部署域名，输入 `BOOTSTRAP_ADMIN_CODE`。管理员在 `/settings` 填入 LLM 聊天接口 URL、模型、API Key，以及 MiniMax Group ID、API Key；使用主题搜索时再填 LLM 搜索接口。
4. 在同一页面生成一次性邀请码，让试用者在 `/enter-code` 兑换。每位试用者每天最多创建三个生成任务，同一时间最多有一个未完成任务。
5. 用一段短文本生成播客，确认 Workflow 结束、音频可以播放和下载、播放器逐句高亮脚本、下载后的 MP3 有正确时长与 `USLT`/`SYLT` 标签。

生产环境改过 `NEXT_PUBLIC_SITE_URL`、`NEXT_PUBLIC_VERCEL_BETA` 等 `NEXT_PUBLIC_` 变量后必须重新构建。工作流回调路径 `/.well-known/workflow/` 由 Workflow 自行认证，不使用浏览器邀请码会话。

本地原有 `yarn start` 与 Docker 服务可继续用于开发；本分支的生产功能走 Vercel Workflow，不启动 BullMQ worker。
