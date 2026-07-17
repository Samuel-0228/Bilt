import type { VerificationState } from "../../../types/index.js";

export const name = "openai";

export async function verify(secret: string): Promise<VerificationState> {
  try {
    const res = await fetch("https://api.openai.com/v1/models", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${secret}`,
      },
    });

    if (res.status === 200) {
      return "verified-live";
    }
    if (res.status === 401) {
      return "verified-dead";
    }
    return "unverified";
  } catch {
    return "unverified";
  }
}
