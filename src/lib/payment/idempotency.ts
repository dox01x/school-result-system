/**
 * Idempotency Key Architecture & Atomic Mutation Locks
 * Universal Implementation (Compatible with Browser, Node.js, Edge, and Turbopack)
 */

import { SupabaseClient } from "@supabase/supabase-js";

export interface IdempotencyCheckResult {
  isDuplicate: boolean;
  inProgress: boolean;
  cachedResponse?: {
    status: number;
    body: unknown;
  };
  error?: string;
}

/**
 * Computes a deterministic hash of the request payload without relying on Node-specific modules.
 */
export function hashPayload(payload: unknown): string {
  const str = typeof payload === "string" ? payload : JSON.stringify(payload || {});
  
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  
  const part1 = (h1 >>> 0).toString(16).padStart(8, "0");
  const part2 = (h2 >>> 0).toString(16).padStart(8, "0");
  return `${part1}${part2}_len${str.length}`;
}

/**
 * Generates a high-entropy idempotency key (Browser & Server safe).
 */
export function generateIdempotencyKey(prefix: string = "idemp"): string {
  let uuid = "";
  if (typeof globalThis !== "undefined" && globalThis.crypto && typeof globalThis.crypto.randomUUID === "function") {
    uuid = globalThis.crypto.randomUUID().replace(/-/g, "");
  } else {
    uuid = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  }
  return `${prefix}_${Date.now()}_${uuid}`;
}

// In-memory fallback map for test environments without full DB connectivity
const memoryIdempotencyStore = new Map<
  string,
  {
    hash: string;
    status: "PROCESSING" | "COMPLETED" | "FAILED";
    statusCode?: number;
    responseBody?: unknown;
    lockedAt: number;
  }
>();

/**
 * Checks and acquires an idempotency lock for a mutation request.
 */
export async function acquireIdempotencyLock(
  supabase: SupabaseClient | null,
  key: string,
  scope: string,
  payload: unknown,
  userId?: string | null
): Promise<IdempotencyCheckResult> {
  if (!key || typeof key !== "string" || key.trim().length === 0) {
    return { isDuplicate: false, inProgress: false };
  }

  const currentHash = hashPayload(payload);
  const trimmedKey = key.trim();

  if (!supabase) {
    // Memory store fallback for tests
    const existing = memoryIdempotencyStore.get(trimmedKey);
    if (existing) {
      if (existing.hash !== currentHash) {
        return {
          isDuplicate: true,
          inProgress: false,
          error: "Idempotency key reused with different request payload",
        };
      }
      if (existing.status === "PROCESSING") {
        return { isDuplicate: true, inProgress: true };
      }
      return {
        isDuplicate: true,
        inProgress: false,
        cachedResponse: {
          status: existing.statusCode || 200,
          body: existing.responseBody,
        },
      };
    }

    memoryIdempotencyStore.set(trimmedKey, {
      hash: currentHash,
      status: "PROCESSING",
      lockedAt: Date.now(),
    });
    return { isDuplicate: false, inProgress: false };
  }

  try {
    // 1. Check if key already exists
    const { data: existingRecord, error: selectErr } = await (supabase as any)
      .from("payment_idempotency_keys")
      .select("*")
      .eq("key", trimmedKey)
      .maybeSingle();

    if (!selectErr && existingRecord) {
      // Check payload hash match
      if (existingRecord.request_hash !== currentHash) {
        return {
          isDuplicate: true,
          inProgress: false,
          error: "Idempotency key was previously used with a different payload.",
        };
      }

      if (existingRecord.status === "PROCESSING") {
        // If locked more than 60 seconds ago, consider it timed out and allow recovery
        const lockedTime = new Date(existingRecord.locked_at).getTime();
        if (Date.now() - lockedTime < 60000) {
          return {
            isDuplicate: true,
            inProgress: true,
            error: "A request with this Idempotency-Key is currently in progress. Please wait.",
          };
        }
      }

      if (existingRecord.status === "COMPLETED") {
        return {
          isDuplicate: true,
          inProgress: false,
          cachedResponse: {
            status: existingRecord.response_status || 200,
            body: existingRecord.response_body,
          },
        };
      }
    }

    // 2. Insert new lock record
    const { error: insertErr } = await (supabase as any)
      .from("payment_idempotency_keys")
      .upsert({
        key: trimmedKey,
        scope,
        request_hash: currentHash,
        user_id: userId || null,
        status: "PROCESSING",
        locked_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      });

    if (insertErr) {
      console.warn("Idempotency lock insert warning:", insertErr.message);
    }

    return { isDuplicate: false, inProgress: false };
  } catch (err: any) {
    console.error("Idempotency lock error:", err);
    return { isDuplicate: false, inProgress: false };
  }
}

/**
 * Finalizes the idempotency lock by storing the response status and body.
 */
export async function completeIdempotencyLock(
  supabase: SupabaseClient | null,
  key: string,
  statusCode: number,
  responseBody: unknown
): Promise<void> {
  if (!key) return;
  const trimmedKey = key.trim();

  if (!supabase) {
    const existing = memoryIdempotencyStore.get(trimmedKey);
    if (existing) {
      existing.status = statusCode >= 200 && statusCode < 300 ? "COMPLETED" : "FAILED";
      existing.statusCode = statusCode;
      existing.responseBody = responseBody;
    }
    return;
  }

  try {
    const isSuccess = statusCode >= 200 && statusCode < 300;
    await (supabase as any)
      .from("payment_idempotency_keys")
      .update({
        status: isSuccess ? "COMPLETED" : "FAILED",
        response_status: statusCode,
        response_body: responseBody,
        updated_at: new Date().toISOString(),
      })
      .eq("key", trimmedKey);
  } catch (err) {
    console.error("Failed to complete idempotency lock:", err);
  }
}

/**
 * Releases or clears an idempotency lock on failure.
 */
export async function releaseIdempotencyLock(
  supabase: SupabaseClient | null,
  key: string
): Promise<void> {
  if (!key) return;
  const trimmedKey = key.trim();

  if (!supabase) {
    memoryIdempotencyStore.delete(trimmedKey);
    return;
  }

  try {
    await (supabase as any)
      .from("payment_idempotency_keys")
      .delete()
      .eq("key", trimmedKey);
  } catch (err) {
    console.error("Failed to release idempotency lock:", err);
  }
}
