// Prisma config — chỉ dùng cho Prisma CLI (migrate, generate, studio)
// prisma-client-js đọc DATABASE_URL từ env trực tiếp lúc runtime
import { config } from 'dotenv';
import { resolve } from 'path';

// Load .env.local trước (override), sau đó .env (fallback)
config({ path: resolve(process.cwd(), '.env.local'), override: true });
config({ path: resolve(process.cwd(), '.env') });

import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    // DIRECT_URL cho migrate (bypass pgBouncer), DATABASE_URL fallback
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL!,
  },
});
