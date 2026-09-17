import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { CACHE_DIR, RAW_DIR, HTTP } from '../config.ts';

export interface FetchResult {
  ok: boolean;
  status: number;
  body: Buffer | null;
  etag: string | null;
  /** 命中条件请求缓存（上游 304）时为 true，此时 body 由本地缓存提供 */
  notModified: boolean;
  error?: string;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function cacheFile(url: string) {
  const hash = crypto.createHash('sha1').update(url).digest('hex').slice(0, 16);
  return path.join(CACHE_DIR, `${hash}.bin`);
}

function rawFile(name: string) {
  return path.join(RAW_DIR, name);
}

/**
 * 带 ETag 条件请求的 GET。
 *
 * 为什么值得为它写这三十行：整条管线每天要拉 5 MB 左右的原始响应，
 * 而绝大多数日子的上游内容是一个字节都没变的。命中 304 时零流量、零解析，
 * 也让「每天同步一次」这件事的成本低到可以忽略。
 */
export async function fetchBinary(url: string): Promise<FetchResult> {
  const cachePath = cacheFile(url);
  const metaPath = `${cachePath}.meta.json`;
  let etag: string | null = null;
  let cachedBody: Buffer | null = null;

  try {
    const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
    etag = meta.etag ?? null;
    cachedBody = fs.readFileSync(cachePath);
  } catch {
    /* 没有缓存，走完整请求 */
  }

  let lastError = '';
  for (let attempt = 0; attempt <= HTTP.retries; attempt += 1) {
    if (attempt > 0) await sleep(HTTP.retryDelayMs * attempt);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), HTTP.timeoutMs);
    try {
      const headers: Record<string, string> = { 'user-agent': HTTP.userAgent };
      if (etag) headers['if-none-match'] = etag;
      const res = await fetch(url, { headers, signal: controller.signal, redirect: 'follow' });

      if (res.status === 304 && cachedBody) {
        return { ok: true, status: 304, body: cachedBody, etag, notModified: true };
      }
      if (!res.ok) {
        lastError = `HTTP ${res.status}`;
        continue;
      }
      const body = Buffer.from(await res.arrayBuffer());
      const newEtag = res.headers.get('etag');
      fs.mkdirSync(CACHE_DIR, { recursive: true });
      fs.writeFileSync(cachePath, body);
      fs.writeFileSync(metaPath, JSON.stringify({ url, etag: newEtag, fetchedAt: new Date().toISOString() }));
      return { ok: true, status: res.status, body, etag: newEtag, notModified: false };
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
    } finally {
      clearTimeout(timer);
    }
  }
  return { ok: false, status: 0, body: null, etag: null, notModified: false, error: lastError };
}

export async function fetchJson<T>(url: string): Promise<{ ok: boolean; data: T | null; notModified: boolean; error?: string }> {
  const r = await fetchBinary(url);
  if (!r.ok || !r.body) return { ok: false, data: null, notModified: false, error: r.error ?? `HTTP ${r.status}` };
  try {
    return { ok: true, data: JSON.parse(r.body.toString('utf8')) as T, notModified: r.notModified };
  } catch (err) {
    return { ok: false, data: null, notModified: false, error: `JSON 解析失败：${String(err)}` };
  }
}

export async function fetchText(url: string): Promise<{ ok: boolean; text: string | null; notModified: boolean; error?: string }> {
  const r = await fetchBinary(url);
  if (!r.ok || !r.body) return { ok: false, text: null, notModified: false, error: r.error ?? `HTTP ${r.status}` };
  return { ok: true, text: r.body.toString('utf8'), notModified: r.notModified };
}

/** 把原始响应落盘到 data/raw/，出问题时可以离线回放整条管线。 */
export function stashRaw(name: string, body: Buffer | null) {
  if (!body) return;
  fs.mkdirSync(RAW_DIR, { recursive: true });
  fs.writeFileSync(rawFile(name), body);
}
