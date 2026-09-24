import 'server-only'
import { AsyncLocalStorage } from 'node:async_hooks'

export type ApiSource = 'own' | 'grant' | 'admin'
export type ApiAccess = { llm: ApiSource; tts: ApiSource }
export type ApiContext = { userId: number; access: ApiAccess }

const storage = new AsyncLocalStorage<ApiContext>()

export function withApiContext<T>(context: ApiContext, action: () => Promise<T>): Promise<T> {
  return storage.run(context, action)
}

export function currentApiContext() { return storage.getStore() }
