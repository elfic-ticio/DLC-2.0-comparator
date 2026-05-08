import { Redis } from "@upstash/redis";
import { StoredVerification, ReferenceDevice } from "@/types";

let _redis: Redis | null = null;

function getRedis(): Redis {
  if (!_redis) {
    _redis = Redis.fromEnv();
  }
  return _redis;
}

export const KV_KEYS = {
  referenceCurrentDevice: "dlc:reference:current",
  referenceHistory: (ts: string) => `dlc:reference:history:${ts}`,
  result: (model: string, serial: string, ts: string) =>
    `dlc:results:${model}:${serial}:${ts}`,
  indexAll: "dlc:index:all",
  indexModel: (model: string) => `dlc:index:model:${model}`,
};

export async function getCurrentReference(): Promise<ReferenceDevice | null> {
  try {
    return await getRedis().get<ReferenceDevice>(KV_KEYS.referenceCurrentDevice);
  } catch {
    return null;
  }
}

export async function saveReference(ref: ReferenceDevice): Promise<void> {
  const redis = getRedis();
  const ts = Date.now().toString();

  const previous = await getCurrentReference();
  if (previous) {
    await redis.set(KV_KEYS.referenceHistory(ts), JSON.stringify(previous));
    await redis.lpush("dlc:reference:history:index", ts);
  }

  await redis.set(KV_KEYS.referenceCurrentDevice, JSON.stringify(ref));
}

export async function getReferenceHistory(): Promise<ReferenceDevice[]> {
  try {
    const redis = getRedis();
    const keys = await redis.lrange("dlc:reference:history:index", 0, 49);
    if (!keys || keys.length === 0) return [];

    const refs = await Promise.all(
      keys.map((ts: unknown) => redis.get<ReferenceDevice>(KV_KEYS.referenceHistory(String(ts))))
    );
    return refs.filter((r): r is ReferenceDevice => r !== null);
  } catch {
    return [];
  }
}

export async function saveVerification(v: StoredVerification): Promise<void> {
  const redis = getRedis();
  const key = KV_KEYS.result(
    v.model.replace(/\s+/g, "_"),
    v.serial.replace(/\s+/g, "_"),
    Date.now().toString()
  );
  v.id = key;

  await redis.set(key, JSON.stringify(v));

  const score = Date.now();
  await redis.zadd(KV_KEYS.indexAll, { score, member: key });
  await redis.zadd(KV_KEYS.indexModel(v.model), { score, member: key });
}

export async function listVerifications(opts: {
  model?: string;
  result?: "PASS" | "FAIL";
  limit?: number;
  offset?: number;
}): Promise<StoredVerification[]> {
  const redis = getRedis();
  const limit = opts.limit ?? 50;
  const offset = opts.offset ?? 0;

  const indexKey = opts.model
    ? KV_KEYS.indexModel(opts.model)
    : KV_KEYS.indexAll;

  const keys: unknown[] = await redis.zrange(indexKey, 0, -1, { rev: true });
  if (!keys || keys.length === 0) return [];

  const all = await Promise.all(
    keys.map((k) => redis.get<StoredVerification>(String(k)))
  );

  let filtered = all.filter((v): v is StoredVerification => v !== null);

  if (opts.result) {
    const wantPass = opts.result === "PASS";
    filtered = filtered.filter((v) => v.overallPass === wantPass);
  }

  return filtered.slice(offset, offset + limit);
}

export async function getVerification(id: string): Promise<StoredVerification | null> {
  try {
    return await getRedis().get<StoredVerification>(id);
  } catch {
    return null;
  }
}

export async function deleteVerification(id: string): Promise<void> {
  const redis = getRedis();
  const v = await getVerification(id);
  if (!v) return;

  await redis.del(id);
  await redis.zrem(KV_KEYS.indexAll, id);
  await redis.zrem(KV_KEYS.indexModel(v.model), id);
}

export async function getStats(): Promise<{
  total: number;
  passed: number;
  failed: number;
  models: string[];
}> {
  try {
    const redis = getRedis();
    const allKeys: unknown[] = await redis.zrange(KV_KEYS.indexAll, 0, -1);
    if (!allKeys || allKeys.length === 0) {
      return { total: 0, passed: 0, failed: 0, models: [] };
    }

    const all = await Promise.all(
      allKeys.map((k) => redis.get<StoredVerification>(String(k)))
    );
    const valid = all.filter((v): v is StoredVerification => v !== null);

    const passed = valid.filter((v) => v.overallPass).length;
    const modelSet = new Set(valid.map((v) => v.model));
    const models = Array.from(modelSet);

    return {
      total: valid.length,
      passed,
      failed: valid.length - passed,
      models,
    };
  } catch {
    return { total: 0, passed: 0, failed: 0, models: [] };
  }
}
