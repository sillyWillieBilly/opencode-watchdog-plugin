export interface SafeHookOptions<T> {
  onError?: (error: Error) => void;
  fallback?: T;
}

export const safeHook = <T, Args extends unknown[]>(
  fn: (...args: Args) => Promise<T>,
  options: SafeHookOptions<T> = {},
) => {
  return async (...args: Args): Promise<T | undefined> => {
    try {
      return await fn(...args);
    } catch (error) {
      const normalized = error instanceof Error ? error : new Error(String(error));
      options.onError?.(normalized);
      console.warn(normalized);
      return options.fallback;
    }
  };
};
