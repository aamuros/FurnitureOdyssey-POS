export async function timeQuery<T>(label: string, query: Promise<T>): Promise<T> {
  const enabled =
    process.env.NODE_ENV !== "production" &&
    process.env.DEBUG_PRISMA_QUERIES === "true";

  if (!enabled) {
    return query;
  }

  const startedAt = performance.now();

  try {
    return await query;
  } finally {
    const durationMs = Math.round(performance.now() - startedAt);
    console.info(`[query] ${label} ${durationMs}ms`);
  }
}
