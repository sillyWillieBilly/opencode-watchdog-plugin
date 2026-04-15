import type { WatchdogConfig } from "@/types";

type PartialRecord = Record<string, unknown>;

const isObject = (value: unknown): value is PartialRecord => typeof value === "object" && value !== null && !Array.isArray(value);

export const deepMerge = <T>(base: T, override: Partial<T>): T => {
  if (!isObject(base) || !isObject(override)) {
    return (override === undefined ? base : override) as T;
  }

  const result: PartialRecord = { ...base };

  for (const [key, value] of Object.entries(override)) {
    if (value === undefined) {
      continue;
    }

    const current = result[key];
    if (Array.isArray(value)) {
      result[key] = [...value];
      continue;
    }

    if (isObject(current) && isObject(value)) {
      result[key] = deepMerge(current, value);
      continue;
    }

    result[key] = value;
  }

  return result as T;
};

export const mergeConfigs = (...configs: Array<Partial<WatchdogConfig> | undefined>): WatchdogConfig => {
  let merged = {} as WatchdogConfig;
  for (const config of configs) {
    if (!config) continue;
    merged = deepMerge(merged, config);
  }
  return merged;
};
