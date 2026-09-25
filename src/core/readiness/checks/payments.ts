// ─── Payments Readiness Check ────────────────────────────────────────────────
// Guided verification for payment integrations, webhook signatures, and PCI hygiene.
// Status: GUIDED — mandatory review when payment processors are detected.
// ─────────────────────────────────────────────────────────────────────────────

import type { ReadinessCategory } from "../taxonomy.js";
import type { BiltCheckFinding, CheckMode } from "../finding.js";
import type { CategoryChecker, CheckContext } from "../check-runner.js";
import { generateCheckFingerprint } from "../finding.js";

const CATEGORY: ReadinessCategory = "payments";

export const paymentsChecker: CategoryChecker = {
  category: CATEGORY,
  mode: "guided" as CheckMode,

  async run(context: CheckContext): Promise<BiltCheckFinding[]> {
    const findings: BiltCheckFinding[] = [];

    const paymentFiles = context.files
      .filter((f) => {
        const p = f.path.replace(/\\/g, "/");
        return (
          !p.includes("/security-engine/") &&
          !p.includes("/readiness/") &&
          !p.includes("/core/rules/") &&
          !p.includes("/core/scan/")
        );
      })
      .filter((f) =>
        /stripe|@stripe\/stripe-js|@paypal|razorpay|lemonsqueezy/i.test(f.content),
      );

    if (paymentFiles.length > 0) {
      // Check for webhook endpoints and signature verification
      const webhookFiles = paymentFiles.filter((f) =>
        /webhook/i.test(f.path) || /webhook/i.test(f.content),
      );

      for (const wf of webhookFiles) {
        const hasSignatureVerification =
          /webhooks\.constructEvent|validateWebhookSignature|verifyHeader|crypto\.timingSafeEqual/i.test(
            wf.content,
          );

        if (!hasSignatureVerification) {
          findings.push({
            ruleId: "CHECK-PAY-001",
            category: CATEGORY,
            mode: "guided",
            severity: "critical",
            precision: "high",
            maturity: "stable",
            status: "needs-review",
            title: `Payment webhook handler in ${wf.path} may lack cryptographic signature verification`,
            whyItMatters:
              "Payment webhooks (such as checkout.session.completed) trigger fulfillment of orders or digital credits. " +
              "Without cryptographic signature verification, an attacker can send fake webhook POST requests to obtain goods without paying.",
            technicalDetail:
              `${wf.path} handles payment webhooks but does not call stripe.webhooks.constructEvent() or verify webhook signatures.`,
            agentAction:
              "Verify the webhook signature using your payment processor's secret key and the raw request body before processing fulfillment.",
            evidenceRequired: true,
            fixable: false,
            file: wf.path,
            line: 1,
            fingerprint: generateCheckFingerprint("CHECK-PAY-001", wf.path, 1),
          });
        }
      }

      // Check for raw card data handling
      for (const pf of paymentFiles) {
        if (/cardNumber|card_number|cvv|cvc|cardExp/i.test(pf.content)) {
          findings.push({
            ruleId: "CHECK-PAY-002",
            category: CATEGORY,
            mode: "automated",
            severity: "critical",
            precision: "medium",
            maturity: "stable",
            status: "fail",
            title: `Potential raw credit card field handling in ${pf.path}`,
            whyItMatters:
              "Handling raw credit card numbers directly on your server places your entire infrastructure under strict PCI-DSS audit requirements. " +
              "Always use processor tokenization (Stripe Elements, Checkout) so card details never touch your server.",
            technicalDetail:
              `${pf.path} references raw card attributes. Payment fields should be collected via hosted fields or processor SDKs.`,
            agentAction:
              "Use Stripe Elements or Stripe Checkout. Never accept raw card number or CVC on your backend.",
            fixable: false,
            file: pf.path,
            line: 1,
            fingerprint: generateCheckFingerprint("CHECK-PAY-002", pf.path, 1),
          });
        }
      }
    }

    return findings;
  },
};
