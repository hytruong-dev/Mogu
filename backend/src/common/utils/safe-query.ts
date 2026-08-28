/**
 * Bọc Prisma query — nếu bảng chưa tồn tại (migration chưa chạy)
 * thì trả về fallback thay vì throw 500.
 * Error code P2021 = "table does not exist"
 */
export async function safeQuery<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch (e: any) {
    if (
      e?.code === 'P2021' ||
      e?.message?.includes('does not exist in the current database') ||
      e?.message?.includes('does not exist')
    ) {
      return fallback;
    }
    throw e;
  }
}
