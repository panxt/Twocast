import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'

// 在开发环境中全局保存数据库连接
declare global {
  var db: ReturnType<typeof drizzle> | undefined
}

export function getDb() {
  // 在开发环境中使用 globalThis 来保存连接
  if (process.env.NODE_ENV === 'development' && !globalThis.db) {
    const client = postgres(process.env.DATABASE_URL!, {
      prepare: false,
      // max: 1, // 开发环境限制最大连接数
      // idle_timeout: 20, // 空闲超时(秒)
    })
    globalThis.db = drizzle({ client })
  }
  // 生产环境使用模块级变量
  else if (process.env.NODE_ENV === 'production' && !globalThis.db) {
    const client = postgres(process.env.DATABASE_URL!, {
      prepare: false,
      // A small pool allows concurrent Fluid requests without blocking every read
      // behind one connection. Supavisor still pools the server connections.
      max: 3,
      idle_timeout: 5,
      max_lifetime: 60,
      keep_alive: 10,
      connect_timeout: 8,
    })
    globalThis.db = drizzle({ client })
  }

  return globalThis.db!
}
