import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createSnapshot, listSnapshots, getLatestSnapshot, restoreSnapshot } from '../src/core/fix/snapshot.js';

describe('Snapshot System', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'bilt-snapshot-test-'));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('should create and restore snapshots successfully', async () => {
    const file1 = path.join(tmpDir, 'test1.txt');
    const file2 = path.join(tmpDir, 'subdir/test2.txt');

    await fs.mkdir(path.dirname(file2), { recursive: true });
    await fs.writeFile(file1, 'content 1', 'utf-8');
    await fs.writeFile(file2, 'content 2', 'utf-8');

    // Create a snapshot
    const snapshot = await createSnapshot([file1, file2], 'Test Snapshot', tmpDir);

    expect(snapshot.id).toBeDefined();
    expect(snapshot.files.length).toBe(2);
    expect(snapshot.files.some((f) => f.path === 'test1.txt')).toBe(true);
    expect(snapshot.files.some((f) => f.path === 'subdir/test2.txt')).toBe(true);

    // Modify files
    await fs.writeFile(file1, 'changed content 1', 'utf-8');
    await fs.writeFile(file2, 'changed content 2', 'utf-8');

    // Check latest snapshot
    const latest = await getLatestSnapshot(tmpDir);
    expect(latest).toBeDefined();
    expect(latest?.id).toBe(snapshot.id);

    // List snapshots
    const all = await listSnapshots(tmpDir);
    expect(all.length).toBe(1);
    expect(all[0]?.id).toBe(snapshot.id);

    // Restore snapshot
    const restored = await restoreSnapshot(snapshot.id, tmpDir);
    expect(restored).toBe(true);

    // Check if content was reverted
    const restored1 = await fs.readFile(file1, 'utf-8');
    const restored2 = await fs.readFile(file2, 'utf-8');

    expect(restored1).toBe('content 1');
    expect(restored2).toBe('content 2');
  });

  it('should return null/false for missing snapshots', async () => {
    const latest = await getLatestSnapshot(tmpDir);
    expect(latest).toBeNull();

    const restored = await restoreSnapshot('invalid-id', tmpDir);
    expect(restored).toBe(false);
  });
});
