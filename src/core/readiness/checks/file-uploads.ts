// ─── File Uploads Readiness Check ────────────────────────────────────────────
// Guided verification for file upload validation, size limits, and storage isolation.
// Status: GUIDED — requires human/agent verification when uploads are present.
// ─────────────────────────────────────────────────────────────────────────────

import type { ReadinessCategory } from "../taxonomy.js";
import type { BiltCheckFinding, CheckMode } from "../finding.js";
import type { CategoryChecker, CheckContext } from "../check-runner.js";
import { generateCheckFingerprint } from "../finding.js";

const CATEGORY: ReadinessCategory = "file-uploads";

export const fileUploadsChecker: CategoryChecker = {
  category: CATEGORY,
  mode: "guided" as CheckMode,

  async run(context: CheckContext): Promise<BiltCheckFinding[]> {
    const findings: BiltCheckFinding[] = [];

    const hasUploads = context.files.some((f) =>
      /multer|formidable|busboy|uploadthing|@aws-sdk\/client-s3|cloudinary|multipart/i.test(
        f.content,
      ),
    );

    if (hasUploads) {
      findings.push({
        ruleId: "CHECK-UPLOAD-GUIDED-001",
        category: CATEGORY,
        mode: "guided",
        severity: "high",
        precision: "medium",
        maturity: "stable",
        status: "needs-review",
        title: "File upload processing detected: verify size limits and MIME validation",
        whyItMatters:
          "Unrestricted file uploads allow attackers to upload executable malware (.php, .exe, .html), " +
          "fill disk storage leading to Denial of Service, or overwrite critical system files.",
        technicalDetail:
          "Detected file upload libraries. Verify that allowed MIME types are strictly allow-listed, " +
          "file size caps are enforced, and uploaded files are stored in an isolated bucket (e.g. S3).",
        agentAction:
          "Verify that file uploads enforce a strict whitelist of extensions/MIME types, " +
          "apply a maximum file size limit (e.g. 5MB), and never save files directly to executable web directories.",
        evidenceRequired: true,
        fixable: false,
        fingerprint: generateCheckFingerprint("CHECK-UPLOAD-GUIDED-001", "upload-handling"),
      });
    }

    return findings;
  },
};
