export function safeAudioBasename(title: string): string {
  return (title || '播客').replace(/[\\/:*?"<>|\r\n]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80) || '播客'
}
