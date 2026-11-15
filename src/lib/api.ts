import type { SupabaseClient } from "@supabase/supabase-js";
export async function api<T>(
  path: string,
  options?: { body: unknown; db?: SupabaseClient | null },
): Promise<T> {
  const token = options?.db
    ? (await options.db.auth.getSession()).data.session?.access_token
    : undefined;
  let response: Response;
  let text: string;
  try {
    response = await fetch(path, {
      method: options ? "POST" : "GET",
      headers: {
        Accept: "application/json",
        ...(options ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: options ? JSON.stringify(options.body) : undefined,
    });
    text = await response.text();
  } catch (cause) {
    throw new Error(`無法連線至服務（${path}），請確認網路與後端服務已啟動。`, { cause });
  }
  const invalidResponse = () => new Error(
    `服務回應格式錯誤（HTTP ${response.status}，${path}）。請確認後端服務已啟動，且 /api 路徑已正確轉送至後端。`,
  );
  let result: unknown;
  try {
    result = JSON.parse(text);
  } catch {
    // Hosting/proxy error pages may contain plain text or HTML, even with status 200.
    throw invalidResponse();
  }
  if (result === null || typeof result !== "object") throw invalidResponse();
  if (!response.ok) {
    const message = "error" in result && typeof result.error === "string"
      ? result.error.trim()
      : "";
    throw new Error(message || `連線失敗（HTTP ${response.status}，${path}），請稍後重試。`);
  }
  return result as T;
}
