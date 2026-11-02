import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { userProfile, dataOverride } from '../src/brand';
test('Mark It Down更名沿用旧资料、不移动或覆盖；新旧数据目录参数兼容', () => {
  const root = mkdtempSync(join(tmpdir(), 'mark-it-down-profile-'));
  assert.equal(userProfile(root), join(root, 'Mark It Down'));
  const legacy = join(root, '知页');
  mkdirSync(join(legacy, 'library'), { recursive: true });
  writeFileSync(join(legacy, 'library', 'sentinel.txt'), '原资料保留');
  assert.equal(userProfile(root), legacy);
  assert.equal(readFileSync(join(legacy, 'library', 'sentinel.txt'), 'utf8'), '原资料保留');
  mkdirSync(join(root, 'Mark It Down', 'library'), { recursive: true });
  assert.equal(userProfile(root), join(root, 'Mark It Down'));
  assert.equal(dataOverride({ ZHIYE_DATA_DIR: 'old' }), 'old');
  assert.equal(dataOverride({ MARKITDOWN_DATA_DIR: 'new', ZHIYE_DATA_DIR: 'old' }), 'new');
});
