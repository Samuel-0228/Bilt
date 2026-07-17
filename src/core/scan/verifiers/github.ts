import type { VerificationState } from "../../../types/index.js";

export const name = "github";

export async function verify(secret: string): Promise<VerificationState> {
  try {
    const res = await fetch("https://api.github.com/user", {
      method: "GET",
      headers: {
        Authorization: `token ${secret}`,
        "User-Agent": "bilt-security-scanner",
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
