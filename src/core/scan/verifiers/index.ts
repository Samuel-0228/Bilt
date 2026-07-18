import * as stripe from "./stripe.js";
import * as github from "./github.js";
import * as aws from "./aws.js";
import * as supabase from "./supabase.js";
import * as openai from "./openai.js";
import * as slack from "./slack.js";
import type { VerificationState } from "../../../types/index.js";

export interface Verifier {
  name: string;
  verify: (secret: string) => Promise<VerificationState>;
}

export const VERIFIERS: Record<string, (secret: string) => Promise<VerificationState>> = {
  stripe: stripe.verify,
  github: github.verify,
  aws: aws.verify,
  supabase: supabase.verify,
  openai: openai.verify,
  slack: slack.verify,
};
