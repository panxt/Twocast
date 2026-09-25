import 'server-only'
import { AsyncLocalStorage } from 'node:async_hooks'

export type ApiSource = 'own' | 'member' | 'grant' | 'admin'
export type ApiAccess = { llm: ApiSource; tts: ApiSource }
export type ApiContext = { userId: number; access: ApiAccess;
  keyOwners?: { llm?: number; tts?: number }; keyShareIds?: { llm?: number; tts?: number } }

const storage = new AsyncLocalStorage<ApiContext>()

export function withApiContext<T>(context: ApiContext, action: () => Promise<T>): Promise<T> {
  return storage.run(context, action)
}

export function currentApiContext() { return storage.getStore() }
