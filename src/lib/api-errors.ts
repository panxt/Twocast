export function describeApiFailure(status: number, service: string): Error {
  if (status === 401 || status === 403) return new Error(`${service} API Key 无效或没有权限，请检查个人配置或管理员授权`)
  if (status === 402 || status === 429) return new Error(`${service} API 额度或速率限制已用完，请更换自己的 Key 或联系管理员`)
  return new Error(`${service} 服务请求失败（HTTP ${status}）`)
}
