import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/utils/user'
import { getTaskByUuid } from '@/models/task'
import { TaskUserInput } from '@/lib/podcast/types'
import { getUploadUrl, readLocalUpload } from '@/lib/podcast/storage'
import { canReadTask } from '@/lib/podcast/access'

export async function GET(_: Request, context: { params: Promise<{ uuid: string }> }) {
  const user = await getCurrentUser()
  if (!user.userEmail) return NextResponse.json({ error: '请先登录' }, { status: 401 })
  const task = await getTaskByUuid((await context.params).uuid)
  if (!task || !canReadTask(task, user)) {
    return NextResponse.json({ error: '文件不存在' }, { status: 404 })
  }
  const input = task.userInputs as TaskUserInput
  if (!input?.fileLocation || !input.fileName) return NextResponse.json({ error: '没有原文件' }, { status: 404 })
  if (input.fileLocation.startsWith('local-upload:')) {
    const bytes = await readLocalUpload(input.fileLocation)
    return new Response(new Uint8Array(bytes), { headers: {
      'content-type': input.fileName.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'text/plain; charset=utf-8',
      'content-disposition': `attachment; filename="source"; filename*=UTF-8''${encodeURIComponent(input.fileName)}`,
    } })
  }
  const url = await getUploadUrl(input.fileLocation, input.fileName)
  return NextResponse.redirect(url)
}
