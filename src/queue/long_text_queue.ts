import { PodcastInputType, PodcastStep, ScriptItem, TaskUserInput } from "@/lib/podcast/types";
import { BaseJobData, LongTextResult } from "./types";

import { getDb } from "@/db/db";
import { tasksTable } from "@/db/schema";
import { Task } from "@/db/types";
import { taskGetStepItem, taskUpdateStepItem } from "@/lib/podcast/task";
import { queryWrap } from "@/utils/db-util";
import { queryChat, parseLLMJson } from "@/utils/xai";
// import Queue, { Job } from "bee-queue";
import { getTaskLogKey } from "@/utils/task";
import { Queue } from 'bullmq';
import { eq } from "drizzle-orm";
import fs from "fs";
import { ChatCompletion } from "openai/resources/index";
import path from "path";
import { getAudioQueue } from "./audio_queue";
import { initQueue } from "./queue_base";
import { getScriptLength } from "@/lib/podcast/client_utils";
import { retry } from "@/lib/podcast/utils";
import { getRedis } from "@/utils/redis";

const QueueName = 'long_text_queue'
const currentStep = PodcastStep.LongText
let queue: Queue<BaseJobData>;

export function getLongTextQueue(): Queue<BaseJobData> {
  if (queue) {
    return queue
  }

  queue = new Queue<BaseJobData>(QueueName, {connection: getRedis()})

  return queue
}

export function setupLongTextQueue() {
  const queue = getLongTextQueue();
  initQueue({
    queue: queue,
    processTask: processLongTextTask,
    currentStep: currentStep,
    queueName: QueueName
  })
}

export async function processLongTextTask(task: Task, enqueueNext = true) {
  const stepItem = taskGetStepItem(task, PodcastStep.LongText)
  const userInputs = task.userInputs as TaskUserInput
  const input = stepItem.input!.slice(0, 100_000)

  // console.log(`[${currentStep}:processTask] generate script, key=${getTaskLogKey(task)}`)
  // 生成脚本
  let text = ''
  let result: LongTextResult
  if (process.env.MOCK_ENABLED) {
    text = `{
    "title": "X上的财富密码：工具/SaaS/AI创业者如何一年内狂揽流量与收入",
    "outline": "## 大纲\\n1. **开场引入**：现象级创业潮背景\\n2. **个人案例拆解**：6位独立开发者的暴利故事\\n3. **公司级标杆**：GrowthXAI的资本神话\\n4. **成功要素分析**：包装器策略与流量红利\\n5. **风险提示**：自报数据的可信度讨论\\n6. **听众行动建议**：如何获取可靠信息",
    "key_points": "## 亮点\\n- 🔥 单枪匹马开发者年入千万美元的实操案例\\n- 🚀 OpenAI包装器仍是当前最暴利的创业模式\\n- 💡 从Flux到Rizzgpt揭示的4个产品设计公式\\n- ⚠️ 网红创始人数据背后的'幸存者偏差'陷阱\\n- 📈 资本视角：1200万刀A轮背后的增长逻辑",
    "script": [
        {
            "role": "主持人",
            "text": "嘿朋友们！今天咱们聊个劲爆话题——你知道现在X平台已经成了印钞机吗？最近爆出好多普通人靠做AI小工具年入百万美元，这到底是真的还是吹牛？"
        },
        {
            "role": "嘉宾",
            "text": "绝对真实！我跟踪了十几个案例，最夸张的是@alex_leiman做的Rizzgpt，你猜怎么着？500万下载量！这哥们儿光靠个聊天机器人就年入1.5亿人民币，还顺手发了个加密货币..."
        },
        {
            "role": "主持人",
            "text": "等等...这太离谱了吧？我做个APP能有5000下载就谢天谢地了。他们到底怎么做到的？"
        },
        {
            "role": "嘉宾",
            "text": "关键在三个字：'包装器'！比如@yasser_elsaid_做的OpenAI套壳工具，本质上就是把ChatGPT接口重新包装，加个特定场景——像写求职信啊、生成菜谱啊，39万刀月流水就到手了！"
        },
        {
            "role": "主持人",
            "text": "哇靠...这不就是二道贩子吗？等等，你刚说还有个更野的？叫什么...Jenni AI？"
        },
        {
            "role": "嘉宾",
            "text": "对！这个更绝——专门帮学生写论文的AI。虽然争议很大，但人家月入50万刀！创始人David就在X上晒过银行流水，评论区都炸了，全是'这TM合法吗'的追问哈哈！"
        },
        {
            "role": "主持人",
            "text": "说到争议...这些数据靠谱吗？毕竟都是他们自己晒的。"
        },
        {
            "role": "嘉宾",
            "text": "问得好！我查证过部分数据——比如GrowthXAI的1200万融资在Crunchbase可查。但有些个人案例...说实话，X上确实存在'收入P图大赛'的现象。建议看三个硬指标：是否敢公开试用、有没有用户实评、能不能查到公司注册信息。"
        },
        {
            "role": "主持人",
            "text": "明白了！最后给想跟风的朋友们一句忠告？"
        },
        {
            "role": "嘉宾",
            "text": "记住：2023年做通用AI工具已经晚了！现在要学@damengchen——找准超级细分场景，比如他专做跨境电商的ChatGPT模板，7万刀/月就是吃透这个红利！"
        }
    ]
}`
    result = parseLLMJson<LongTextResult>(text)
  } else {
    // 并行生成大纲和脚本以提高性能
    const [outlineResult, scriptResult] = await Promise.all([
      retry(async () => {
        const result = await genOutline(input, userInputs)
        if (!result.title || !result.outline) {
          throw new Error(`genOutline failed, title: ${!!result.title}, outline: ${!!result.outline}`)
        }
        if (typeof result.title != 'string' || typeof result.outline != 'string') {
          throw new Error(`genOutline failed, title: ${typeof result.title}, outline: ${typeof result.outline}`)
        }
        return result
      }),
      retry(async () => {
        const result = await genScript(input, userInputs)
        if (!Array.isArray(result) || result.length == 0) {
          throw new Error(`genScript failed, isArray: ${Array.isArray(result)}, length: ${result.length}`)
        }
        return result
      })
    ])
    // console.log(`[${currentStep}:processTask] genOutlineResult=${JSON.stringify(outlineResult)}, genScriptResult=${JSON.stringify(scriptResult)}`)
    // return
    result = {
      title: outlineResult.title,
      outline: outlineResult.outline,
      key_points: '',
      script: scriptResult,
      script_length: getScriptLength(scriptResult)
    }
  }


  // 下一步的参数
  taskUpdateStepItem(task, PodcastStep.Audio, {
    input: result,
  })
  if (process.env.NEXT_PUBLIC_CLERK_ENABLED) {
  }

  // save to db
  await queryWrap(getDb().update(tasksTable).set({
    stepsDetail: task.stepsDetail
  }).where(eq(tasksTable.id, task.id)))

  // 传给下个队列
  if (enqueueNext) await getAudioQueue().add('audio', { task: task })
}

export interface GenOutlineResult {
  title: string
  outline: string
}

export async function genOutline(text: string, userInputs: TaskUserInput): Promise<GenOutlineResult> {
  let prompt = fs.readFileSync(path.join(process.cwd(), 'resources/prompts/gen_outline.md'), 'utf-8')
  if (userInputs.language && userInputs.language != 'auto') {
    prompt = prompt.replace('输出语言为: 原资料语言', `输出语言为: ${userInputs.language}`)
  }
  console.log(`[${currentStep}:genOutline] prompt=${prompt}`)
  const resp = await queryChat(text + '\n\n' + prompt, { json: true })
  const data = resp.data as ChatCompletion
  // print token usage
  console.log(`[${currentStep}:genOutline] token usage=${JSON.stringify(data.usage)}`)
  const result = parseLLMJson<GenOutlineResult>(data.choices[0].message.content!)
  return result
}

export async function genScript(text: string, userInputs: TaskUserInput): Promise<ScriptItem[]> {
  let prompt = fs.readFileSync(path.join(process.cwd(), 'resources/prompts/gen_script.md'), 'utf-8')
  if (userInputs.language && userInputs.language != 'auto') {
    prompt = prompt.replace('输出语言为: 原资料语言', `输出语言为: ${userInputs.language}`)
  }
  if (userInputs.type == PodcastInputType.FrontPage) {
    prompt = prompt.replace('{minimum_words}', '3000')
  } else {
    prompt = prompt.replace('{minimum_words}', '1000')
  }
  const resp = await queryChat(text + '\n\n' + prompt, { json: true })
  const data = resp.data as ChatCompletion
  const json = parseLLMJson<{ script: ScriptItem[] }>(data.choices[0].message.content!)
  const items = json.script
  for (const item of items) {
    // 兼容 gpt-4o-mini 的 bug
    if (!item.text) {
      const role = Object.keys(item)[0]
      item.text = item[role]
      item.role = role
      delete item[role]
    }
  }
  // print token usage
  console.log(`[${currentStep}:genScript] token usage=${JSON.stringify(data.usage)}`)
  return items
}
