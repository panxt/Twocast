export function storageUploadError(status: number, detail: string, content: string): Error {
  if (status === 413 || /payload.*large|maximum.*size|exceeded.*size|entity too large/i.test(detail)) {
    return new Error(`${content}超过云存储的单文件大小上限，请缩小内容或联系管理员调整存储配置`)
  }
  if (status === 507 || /quota|storage.*full|capacity|insufficient.*storage/i.test(detail)) {
    return new Error(`云存储额度不足，${content}保存失败；请联系管理员清理空间或调整套餐`)
  }
  if (status === 429) return new Error('云存储请求过于频繁，请稍后重试')
  if (status === 401 || status === 403) return new Error('云存储访问被拒绝，请联系管理员检查存储权限或套餐状态')
  return new Error(`${content}保存失败（存储服务 ${status}），请稍后重试；持续失败请联系管理员`)
}
