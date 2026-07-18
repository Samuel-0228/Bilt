import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import fg from "fast-glob";
import type { VerificationState } from "../../../types/index.js";

export const name = "aws";

function hmac(key: Buffer | string, data: string): Buffer {
  return crypto.createHmac("sha256", key).update(data).digest();
}

function sha256(data: string): string {
  return crypto.createHash("sha256").update(data).digest("hex");
}

async function findCompanionAWSKey(
  key: string,
  isAccessKey: boolean,
): Promise<string | null> {
  if (isAccessKey) {
    if (process.env["AWS_SECRET_ACCESS_KEY"]) return process.env["AWS_SECRET_ACCESS_KEY"];
  } else {
    if (process.env["AWS_ACCESS_KEY_ID"]) return process.env["AWS_ACCESS_KEY_ID"];
  }

  try {
    const cwd = process.cwd();
    const envFiles = await fg([".env", ".env.*"], { cwd, absolute: true });
    for (const file of envFiles) {
      try {
        const content = await fs.readFile(file, "utf-8");
        if (isAccessKey) {
          const match = content.match(/(?:AWS_SECRET_ACCESS_KEY\s*=\s*|['"]?)([A-Za-z0-9/+]{40})(?![A-Za-z0-9/+=])/);
          if (match?.[1]) return match[1];
        } else {
          const match = content.match(/(?:AWS_ACCESS_KEY_ID\s*=\s*|['"]?)(AKIA[0-9A-Z]{16})(?![A-Z0-9])/);
          if (match?.[1]) return match[1];
        }
      } catch {}
    }
  } catch {}

  return null;
}

export async function verify(secret: string): Promise<VerificationState> {
  const isAccessKey = secret.startsWith("AKIA");
  const accessKeyId = isAccessKey ? secret : await findCompanionAWSKey(secret, false);
  const secretAccessKey = isAccessKey ? await findCompanionAWSKey(secret, true) : secret;

  if (!accessKeyId || !secretAccessKey) {
    return "unverified";
  }

  try {
    const url = "https://sts.amazonaws.com/?Action=GetCallerIdentity&Version=2011-06-15";
    const host = "sts.amazonaws.com";
    const service = "sts";
    const region = "us-east-1";

    const now = new Date();
    const amzDate = now.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
    const dateStamp = amzDate.slice(0, 8);

    const canonicalUri = "/";
    const canonicalQuery = "Action=GetCallerIdentity&Version=2011-06-15";
    const canonicalHeaders = `host:${host}\nx-amz-date:${amzDate}\n`;
    const signedHeaders = "host;x-amz-date";
    const payloadHash = sha256("");

    const canonicalRequest = `POST\n${canonicalUri}\n${canonicalQuery}\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`;

    const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
    const stringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${credentialScope}\n${sha256(canonicalRequest)}`;

    const kDate = hmac("AWS4" + secretAccessKey, dateStamp);
    const kRegion = hmac(kDate, region);
    const kService = hmac(kRegion, service);
    const kSigning = hmac(kService, "aws4_request");

    const signature = hmac(kSigning, stringToSign).toString("hex");

    const authHeader = `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

    const res = await fetch(url, {
      method: "POST",
      headers: {
        Host: host,
        "X-Amz-Date": amzDate,
        Authorization: authHeader,
      },
    });

    if (res.status === 200) {
      return "verified-live";
    }
    if (res.status === 403) {
      const text = await res.text();
      if (
        text.includes("InvalidClientTokenId") ||
        text.includes("SignatureDoesNotMatch") ||
        text.includes("AuthFailure")
      ) {
        return "verified-dead";
      }
    }
    return "unverified";
  } catch {
    return "unverified";
  }
}
