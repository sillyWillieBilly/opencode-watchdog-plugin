export const withTimeout = async <T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> => {
  let timer: Timer | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error(message)), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
};

export const wrapProviderError = (providerName: string, error: unknown): Error =>
  error instanceof Error ? new Error(`[${providerName}] ${error.message}`) : new Error(`[${providerName}] ${String(error)}`);
