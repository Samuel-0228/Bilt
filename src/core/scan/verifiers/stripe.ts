import type { VerificationState } from "../../../types/index.js";

export const name = "stripe";

export async function verify(secret: string): Promise<VerificationState> {
  try {
    const res = await fetch("https://api.stripe.com/v1/balance", {
      method: "GET",
      headers: {
        Authorization: `Basic ${Buffer.from(secret + ":").toString("base64")}`,
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
