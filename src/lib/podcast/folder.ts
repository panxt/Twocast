// 目录路径规则：以 / 开头和结尾，每段 1~40 字，不含控制字符与反斜杠。根目录是 '/'。
export function isValidFolderPath(folderPath: unknown): folderPath is string {
  if (typeof folderPath !== 'string' || !folderPath.startsWith('/') || !folderPath.endsWith('/')) return false
  if (folderPath.length > 255 || folderPath.includes('\\')) return false
  const segments = folderPath.split('/')
  return !segments.some((segment, index) => index > 0 && index < segments.length - 1 &&
    (!segment || segment.length > 40 || [...segment].some(character => character.charCodeAt(0) < 32)))
}
