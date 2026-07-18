import type { VerificationState } from "../../../types/index.js";

export const name = "supabase";

export async function verify(secret: string): Promise<VerificationState> {
  try {
    const parts = secret.split(".");
    if (parts.length !== 3) return "unverified";

    const payloadRaw = Buffer.from(parts[1]!, "base64").toString("utf-8");
    const payload = JSON.parse(payloadRaw);

    const iss = payload.iss;
    if (!iss || typeof iss !== "string") return "unverified";

    const match = iss.match(/^(https:\/\/[a-z0-9-]+\.supabase\.co)/);
    if (!match?.[1]) return "unverified";

    const baseUrl = match[1];

    const res = await fetch(`${baseUrl}/rest/v1/`, {
      method: "GET",
      headers: {
        apikey: secret,
        Authorization: `Bearer ${secret}`,
      },
    });

    if (res.status === 200) {
      return "verified-live";
    }
    if (res.status === 401 || res.status === 403) {
      return "verified-dead";
    }
    return "unverified";
  } catch {
    return "unverified";
  }
}
