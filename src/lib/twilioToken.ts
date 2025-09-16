import { getServerUrl } from "../config";

export async function fetchTwilioToken(
  identity: string,
  room: string,
  serverUrl?: string
) {
  const url = serverUrl || `${getServerUrl()}/api/token`;
  console.log(`[fetchTwilioToken] Requesting token from: ${url}`);
  console.log(`[fetchTwilioToken] Request body:`, { identity, room });

  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ identity, room }),
  });

  console.log(`[fetchTwilioToken] Response status: ${res.status}`);
  console.log(
    `[fetchTwilioToken] Response headers:`,
    Object.fromEntries(res.headers.entries())
  );

  const data = await res.json();
  console.log(`[fetchTwilioToken] Response data:`, data);

  if (!res.ok) {
    console.error(`[fetchTwilioToken] Error response:`, data);
    throw new Error(data.error || "Token error");
  }

  console.log(`[fetchTwilioToken] Token received successfully`);
  return data.token as string;
}
