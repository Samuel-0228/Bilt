// ─── Secrets Module Tests ────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import { calculateShannonEntropy, isHighEntropy } from '../src/core/rules/entropy.js';
import { SECRET_RULES } from '../src/core/rules/secret-rules.js';
import { PROVIDER_MAP, detectProvider } from '../src/core/rules/providers.js';
import { scanFileForSecrets } from '../src/core/scan/secrets.js';
import { DEFAULT_CONFIG } from '../src/config/config.js';

// ─── Shannon Entropy ─────────────────────────────────────────────────────────

describe('calculateShannonEntropy', () => {
  it('should return 0 for a single repeated character', () => {
    const entropy = calculateShannonEntropy('aaaaaaa');
    expect(entropy).toBe(0);
  });

  it('should return 1.0 for two equally frequent characters', () => {
    const entropy = calculateShannonEntropy('ababababab');
    expect(entropy).toBeCloseTo(1.0, 1);
  });

  it('should return higher entropy for more diverse strings', () => {
    const low = calculateShannonEntropy('aabbcc');
    const high = calculateShannonEntropy('a1b2c3d4e5f6g7');
    expect(high).toBeGreaterThan(low);
  });

  it('should return high entropy for UUID-like strings', () => {
    const entropy = calculateShannonEntropy('550e8400-e29b-41d4-a716-446655440000');
    expect(entropy).toBeGreaterThan(3.0);
  });

  it('should handle empty string', () => {
    const entropy = calculateShannonEntropy('');
    expect(entropy).toBe(0);
  });

  it('should handle single character', () => {
    const entropy = calculateShannonEntropy('x');
    expect(entropy).toBe(0);
  });
});

describe('isHighEntropy', () => {
  it('should flag random-looking strings as high entropy', () => {
    // A typical API key has high entropy
    expect(isHighEntropy('sk_' + 'test_4eC39HqLyjWDarjtT1zdp7dc', 4.0)).toBe(true);
  });

  it('should not flag English words', () => {
    expect(isHighEntropy('hello_world', 4.0)).toBe(false);
  });

  it('should respect custom threshold', () => {
    const str = 'abcdefgj';
    const entropy = calculateShannonEntropy(str);
    expect(isHighEntropy(str, entropy - 0.1)).toBe(true);
    expect(isHighEntropy(str, entropy + 0.1)).toBe(false);
  });
});

// ─── Secret Rule Patterns ────────────────────────────────────────────────────

describe('SECRET_RULES', () => {
  it('should include AWS access key rule', () => {
    const rule = SECRET_RULES.find((r) => r.id.includes('aws'));
    expect(rule).toBeDefined();
  });

  it('should match AWS access key pattern', () => {
    const rule = SECRET_RULES.find((r) => r.id.includes('aws') && r.name.toLowerCase().includes('access'));
    if (rule) {
      expect(rule.pattern.test('AKIAIOSFODNN7EXAMPLE')).toBe(true);
    }
  });

  it('should include Stripe key rule', () => {
    const rule = SECRET_RULES.find(
      (r) => r.id.includes('stripe') || r.name.toLowerCase().includes('stripe'),
    );
    expect(rule).toBeDefined();
  });

  it('should match Stripe live key pattern', () => {
    const rule = SECRET_RULES.find(
      (r) => r.id.includes('stripe') || r.name.toLowerCase().includes('stripe'),
    );
    if (rule) {
      expect(
        rule.pattern.test('sk_' + 'live_000000000000000000000000'),
      ).toBe(true);
    }
  });

  it('should include GitHub token rule', () => {
    const rule = SECRET_RULES.find(
      (r) => r.id.includes('github') || r.name.toLowerCase().includes('github'),
    );
    expect(rule).toBeDefined();
  });

  it('should match GitHub PAT pattern', () => {
    const rule = SECRET_RULES.find(
      (r) => r.id.includes('github') || r.name.toLowerCase().includes('github'),
    );
    if (rule) {
      expect(
        rule.pattern.test('ghp_' + 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdef123456'),
      ).toBe(true);
    }
  });

  it('should include OpenAI key rule', () => {
    const rule = SECRET_RULES.find(
      (r) => r.id.includes('openai') || r.name.toLowerCase().includes('openai'),
    );
    expect(rule).toBeDefined();
  });

  it('should have severity on all rules', () => {
    for (const rule of SECRET_RULES) {
      expect(['critical', 'warning', 'info']).toContain(rule.severity);
    }
  });
});

// ─── Provider Detection ──────────────────────────────────────────────────────

describe('detectProvider', () => {
  it('should detect AWS provider from AKIA prefix', () => {
    const provider = detectProvider('AKIAIOSFODNN7EXAMPLE');
    expect(provider).toBeDefined();
    expect(provider?.name).toContain('aws');
  });

  it('should detect Stripe provider from sk_live prefix', () => {
    const provider = detectProvider('sk_' + 'live_000000000000000000000000');
    expect(provider).toBeDefined();
    expect(provider?.name).toContain('stripe');
  });

  it('should detect GitHub provider from ghp_ prefix', () => {
    const provider = detectProvider('ghp_' + 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdef12');
    expect(provider).toBeDefined();
    expect(provider?.name).toContain('github');
  });

  it('should return undefined for unknown patterns', () => {
    const provider = detectProvider('just_a_regular_string');
    expect(provider).toBeUndefined();
  });

  it('should have rotation URLs for all providers in PROVIDER_MAP', () => {
    for (const [, provider] of Object.entries(PROVIDER_MAP)) {
      expect(provider.rotationUrl).toBeTruthy();
      expect(provider.rotationUrl).toContain('http');
    }
  });
});

// ─── scanFileForSecrets ──────────────────────────────────────────────────────

describe('scanFileForSecrets', () => {
  it('should detect an AWS key in file content', () => {
    const content = `const key = "AKIAIOSFODNN7EXAMPLE";`;
    const findings = scanFileForSecrets(content, 'config.js', DEFAULT_CONFIG);

    const awsFinding = findings.find((f) =>
      f.message.toLowerCase().includes('aws'),
    );
    expect(awsFinding).toBeDefined();
    expect(awsFinding?.severity).toBe('critical');
  });

  it('should detect a Stripe key in file content', () => {
    const stripeVal = 'sk_' + 'test_4eC39HqLyjWDarjtT1zdp7dc';
    const content = `STRIPE_KEY=${stripeVal}`;
    const findings = scanFileForSecrets(content, '.env', DEFAULT_CONFIG);

    const stripeFinding = findings.find(
      (f) =>
        f.message.toLowerCase().includes('stripe') ||
        f.provider?.name.includes('stripe'),
    );
    expect(stripeFinding).toBeDefined();
  });

  it('should not flag placeholder values', () => {
    const content = `
      API_KEY=your_api_key_here
      SECRET=changeme
      TOKEN=<your-token>
      KEY=xxxxxxxxxxxx
    `;
    const findings = scanFileForSecrets(content, '.env.example', DEFAULT_CONFIG);

    // Placeholder values should be filtered out
    expect(findings.length).toBe(0);
  });

  it('should not flag empty values', () => {
    const content = `API_KEY=\nSECRET=\n`;
    const findings = scanFileForSecrets(content, '.env', DEFAULT_CONFIG);

    expect(findings.length).toBe(0);
  });

  it('should report file name in findings', () => {
    const content = `const key = "AKIAIOSFODNN7EXAMPLE";`;
    const findings = scanFileForSecrets(content, 'src/config.ts', DEFAULT_CONFIG);

    for (const finding of findings) {
      expect(finding.file).toBe('src/config.ts');
    }
  });
});
