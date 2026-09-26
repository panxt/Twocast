// 封面对外只暴露受保护的接口地址（与音频一致），不直接暴露存储路径。
export function coverUrlFor(uuid: string, location?: string | null): string | null {
  if (!location) return null
  if (location.startsWith('/assets/')) return location
  return `/api/protected/tasks/${encodeURIComponent(uuid)}/cover?v=${encodeURIComponent(location.split('/').pop() || '')}`
}
