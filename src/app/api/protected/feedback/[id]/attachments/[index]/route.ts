import { guard, viewer, ticketFor, storageCall, FeedbackError } from '@/lib/feedback'
export async function GET(
  _req: Request,
  context: { params: Promise<{ id: string; index: string }> }
) {
  return guard(async () => {
    const user = await viewer(),
      { id, index } = await context.params,
      ticket = await ticketFor(user, id)
    if (!/^\d+$/.test(index)) throw new FeedbackError('附件不存在', 404)
    const attachment = ticket.attachments?.[Number(index)]
    if (!attachment) throw new FeedbackError('附件不存在', 404)
    const response = await storageCall(`object/feedback-images/${attachment.key}`)
    return new Response(response.body, {
      headers: {
        'content-type': attachment.type,
        'cache-control': 'private, no-store',
        'x-content-type-options': 'nosniff',
      },
    })
  })
}
