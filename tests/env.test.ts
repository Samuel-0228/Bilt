// ─── Env Module Tests ────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import {
  parseEnvFile,
  diffEnvFiles,
  scanCodeForEnvRefs,
  findMissingEnvVars,
  findUnusedEnvVars,
} from '../src/core/scan/env.js';

// ─── parseEnvFile ────────────────────────────────────────────────────────────

describe('parseEnvFile', () => {
  it('should parse basic KEY=VALUE pairs', () => {
    const content = 'DB_HOST=localhost\nDB_PORT=5432\n';
    const result = parseEnvFile(content, '.env');

    expect(result.filePath).toBe('.env');
    expect(result.entries.size).toBe(2);
    expect(result.entries.get('DB_HOST')?.value).toBe('localhost');
    expect(result.entries.get('DB_PORT')?.value).toBe('5432');
  });

  it('should handle double-quoted values', () => {
    const content = 'SECRET="my secret value"\n';
    const result = parseEnvFile(content, '.env');

    expect(result.entries.get('SECRET')?.value).toBe('my secret value');
  });

  it('should handle single-quoted values', () => {
    const content = "API_KEY='sk_test_abc123'\n";
    const result = parseEnvFile(content, '.env');

    expect(result.entries.get('API_KEY')?.value).toBe('sk_test_abc123');
  });

  it('should skip comments', () => {
    const content = '# This is a comment\nKEY=value\n# Another comment\n';
    const result = parseEnvFile(content, '.env');

    expect(result.entries.size).toBe(1);
    expect(result.entries.get('KEY')?.value).toBe('value');
  });

  it('should skip empty lines', () => {
    const content = '\n\nKEY1=a\n\n\nKEY2=b\n\n';
    const result = parseEnvFile(content, '.env');

    expect(result.entries.size).toBe(2);
  });

  it('should handle values with equals signs', () => {
    const content = 'URL=postgres://host:5432/db?sslmode=require\n';
    const result = parseEnvFile(content, '.env');

    expect(result.entries.get('URL')?.value).toBe(
      'postgres://host:5432/db?sslmode=require',
    );
  });

  it('should handle empty values', () => {
    const content = 'EMPTY=\nALSO_EMPTY=\n';
    const result = parseEnvFile(content, '.env');

    expect(result.entries.get('EMPTY')?.value).toBe('');
    expect(result.entries.get('ALSO_EMPTY')?.value).toBe('');
  });

  it('should track line numbers', () => {
    const content = '# comment\nKEY1=a\n\nKEY2=b\n';
    const result = parseEnvFile(content, '.env');

    expect(result.entries.get('KEY1')?.line).toBe(2);
    expect(result.entries.get('KEY2')?.line).toBe(4);
  });

  it('should preserve raw lines', () => {
    const content = '# header\nKEY=val\n';
    const result = parseEnvFile(content, '.env');

    expect(result.rawLines).toEqual(['# header', 'KEY=val', '']);
  });
});

// ─── diffEnvFiles ────────────────────────────────────────────────────────────

describe('diffEnvFiles', () => {
  it('should detect missing vars between env files', () => {
    const env1 = parseEnvFile('A=1\nB=2\nC=3\n', '.env');
    const env2 = parseEnvFile('A=1\nC=3\n', '.env.production');

    const findings = diffEnvFiles(env1, env2);

    const missing = findings.filter((f) => f.category === 'env-mismatch');
    expect(missing.length).toBeGreaterThan(0);
    // B is in env1 but not env2
    const bMissing = missing.find((f) => f.message.includes('B'));
    expect(bMissing).toBeDefined();
  });

  it('should detect extra vars in second file', () => {
    const env1 = parseEnvFile('A=1\n', '.env');
    const env2 = parseEnvFile('A=1\nEXTRA=val\n', '.env.staging');

    const findings = diffEnvFiles(env1, env2);
    const extras = findings.filter(
      (f) => f.message.includes('EXTRA'),
    );
    expect(extras.length).toBeGreaterThan(0);
  });

  it('should return empty for identical files', () => {
    const env1 = parseEnvFile('A=1\nB=2\n', '.env');
    const env2 = parseEnvFile('A=x\nB=y\n', '.env.local');

    const findings = diffEnvFiles(env1, env2);
    // Same keys, different values — no mismatch findings about missing keys
    const keyMismatch = findings.filter(
      (f) =>
        f.category === 'env-mismatch' &&
        (f.message.includes('missing') || f.message.includes('Missing')),
    );
    expect(keyMismatch.length).toBe(0);
  });
});

// ─── scanCodeForEnvRefs ──────────────────────────────────────────────────────

describe('scanCodeForEnvRefs', () => {
  it('should detect process.env.VAR_NAME', () => {
    const code = `
      const host = process.env.DB_HOST;
      const port = process.env.DB_PORT;
    `;
    const refs = scanCodeForEnvRefs(code);

    expect(refs).toContain('DB_HOST');
    expect(refs).toContain('DB_PORT');
  });

  it('should detect process.env["VAR_NAME"]', () => {
    const code = `const key = process.env["API_KEY"];`;
    const refs = scanCodeForEnvRefs(code);

    expect(refs).toContain('API_KEY');
  });

  it('should detect import.meta.env.VITE_VAR', () => {
    const code = `const url = import.meta.env.VITE_API_URL;`;
    const refs = scanCodeForEnvRefs(code);

    expect(refs).toContain('VITE_API_URL');
  });

  it('should return empty set for code without env refs', () => {
    const code = `const x = 42;\nconsole.log("hello");`;
    const refs = scanCodeForEnvRefs(code);

    expect(refs.size).toBe(0);
  });

  it('should detect os.environ patterns (Python)', () => {
    const code = `db_url = os.environ["DATABASE_URL"]\nkey = os.environ.get("SECRET_KEY")`;
    const refs = scanCodeForEnvRefs(code);

    expect(refs).toContain('DATABASE_URL');
    expect(refs).toContain('SECRET_KEY');
  });
});

// ─── findMissingEnvVars ──────────────────────────────────────────────────────

describe('findMissingEnvVars', () => {
  it('should detect vars referenced in code but not in .env', () => {
    const envRefs = new Set(['DB_HOST', 'DB_PORT', 'SECRET_KEY']);
    const definedKeys = new Set(['DB_HOST', 'DB_PORT']);

    const findings = findMissingEnvVars(envRefs, definedKeys, '.env');

    expect(findings.length).toBe(1);
    expect(findings[0]?.message).toContain('SECRET_KEY');
    expect(findings[0]?.category).toBe('env-missing');
  });

  it('should return empty if all vars are defined', () => {
    const envRefs = new Set(['A', 'B']);
    const definedKeys = new Set(['A', 'B', 'C']);

    const findings = findMissingEnvVars(envRefs, definedKeys, '.env');

    expect(findings.length).toBe(0);
  });
});

// ─── findUnusedEnvVars ───────────────────────────────────────────────────────

describe('findUnusedEnvVars', () => {
  it('should detect vars defined in .env but not referenced in code', () => {
    const definedKeys = new Set(['A', 'B', 'C']);
    const envRefs = new Set(['A']);

    const findings = findUnusedEnvVars(definedKeys, envRefs, '.env');

    expect(findings.length).toBe(2);
    const messages = findings.map((f) => f.message);
    expect(messages.some((m) => m.includes('B'))).toBe(true);
    expect(messages.some((m) => m.includes('C'))).toBe(true);
  });

  it('should return empty if all vars are used', () => {
    const definedKeys = new Set(['X', 'Y']);
    const envRefs = new Set(['X', 'Y']);

    const findings = findUnusedEnvVars(definedKeys, envRefs, '.env');

    expect(findings.length).toBe(0);
  });
});
