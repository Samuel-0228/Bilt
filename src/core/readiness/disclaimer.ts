export const DISCLAIMER = 
  'Bilt is an automated readiness check, not a certified security audit. ' +
  'A \'production-ready\' result means known common gaps were checked and ' +
  'not found; it does not guarantee the absence of vulnerabilities.';

export function formatDisclaimer(): string {
  return `\n================================================================================\n` +
         `DISCLAIMER: ${DISCLAIMER}\n` +
         `================================================================================\n`;
}

export function getDisclaimerText(): string {
  return DISCLAIMER;
}
