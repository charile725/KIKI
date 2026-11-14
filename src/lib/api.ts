import type { SupabaseClient } from "@supabase/supabase-js";
export async function api<T>(
  path: string,
  options?: { body: unknown; db?: SupabaseClient | null },
): Promise<T> {
  const token = options?.db
    ? (await options.db.auth.getSession()).data.session?.access_token
    : undefined;
  const response = await fetch(path, {
    method: options ? "POST" : "GET",
    headers: options
      ? {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        }
      : undefined,
    body: options ? JSON.stringify(options.body) : undefined,
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "連線失敗，請稍後重試。");
  return result as T;
}
