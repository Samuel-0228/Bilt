import type { SecurityRule } from "../types.js";
import { authRules } from "./auth-rules.js";
import { authzRules } from "./authz-rules.js";
import { aiIntegrationRules } from "./ai-integration-rules.js";
import { inputValidationRules } from "./input-validation-rules.js";
import { storageNetworkingRules } from "./storage-networking-rules.js";
import { businessLogicRules } from "./business-logic-rules.js";
import { apiConfigRules } from "./api-config-rules.js";
import { dockerGitDepRules } from "./docker-git-dep-rules.js";
import { filesystemCryptoSupplyRules } from "./filesystem-crypto-supply-rules.js";

export const ALL_SECURITY_RULES: SecurityRule[] = [
  ...authRules,
  ...authzRules,
  ...aiIntegrationRules,
  ...inputValidationRules,
  ...storageNetworkingRules,
  ...businessLogicRules,
  ...apiConfigRules,
  ...dockerGitDepRules,
  ...filesystemCryptoSupplyRules,
];

export {
  authRules,
  authzRules,
  aiIntegrationRules,
  inputValidationRules,
  storageNetworkingRules,
  businessLogicRules,
  apiConfigRules,
  dockerGitDepRules,
  filesystemCryptoSupplyRules,
};
