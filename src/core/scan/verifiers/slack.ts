import type { VerificationState } from "../../../types/index.js";

export const name = "slack";

export async function verify(secret: string): Promise<VerificationState> {
  try {
    if (secret.includes("hooks.slack.com")) {
      return "unverified";
    }

    const res = await fetch("https://slack.com/api/auth.test", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secret}`,
      },
    });

    if (res.status === 200) {
      const data = (await res.json()) as { ok: boolean };
      if (data.ok) {
        return "verified-live";
      } else {
        return "verified-dead";
      }
    }
    return "unverified";
  } catch {
    return "unverified";
  }
}
