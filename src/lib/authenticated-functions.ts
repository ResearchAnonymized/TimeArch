import { supabase } from "@/integrations/supabase/client";

export async function getRequiredAccessToken(forceRefresh = false): Promise<string> {
  const { data: sessionData } = forceRefresh
    ? await supabase.auth.refreshSession()
    : await supabase.auth.getSession();
  let token = sessionData.session?.access_token ?? null;

  if (!token) {
    const { data: refreshed } = await supabase.auth.refreshSession();
    token = refreshed.session?.access_token ?? null;
  }

  if (!token) {
    throw new Error("Your session has expired. Please sign in again.");
  }

  return token;
}

async function postFunction(functionName: string, body: unknown, token: string) {
  return fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${functionName}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
}

export async function callAuthenticatedFunction<T = unknown>(
  functionName: string,
  body: unknown,
): Promise<T> {
  let response = await postFunction(functionName, body, await getRequiredAccessToken());
  if (response.status === 401 || response.status === 403) {
    response = await postFunction(functionName, body, await getRequiredAccessToken(true));
  }

  const text = await response.text();
  const data = text ? JSON.parse(text) : {};

  if (!response.ok) {
    throw new Error(data.error || data.message || `Function failed with status ${response.status}`);
  }

  return data as T;
}
