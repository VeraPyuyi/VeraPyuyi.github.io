import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { parse } from 'yaml';
import {
  $bgmAutoplayOptOut,
  BGM_AUTOPLAY_OPT_OUT_KEY,
  disableBgmAutoplay,
  enableBgmAutoplay,
  initializeBgmPreference,
} from '../../src/store/bgm';

class MemoryStorage {
  readonly values = new Map<string, string>();
  get length() {
    return this.values.size;
  }
  clear() {
    this.values.clear();
  }
  getItem(key: string) {
    return this.values.get(key) ?? null;
  }
  key(index: number) {
    return [...this.values.keys()][index] ?? null;
  }
  removeItem(key: string) {
    this.values.delete(key);
  }
  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

test('disabled empty BGM configuration performs no playlist work', () => {
  const root = process.cwd();
  const config = parse(readFileSync(join(root, 'config/site.yaml'), 'utf8'));
  assert.equal(config.bgm.enabled, false);
  assert.equal(config.bgm.autoplay, true);
  assert.equal(config.bgm.rememberOptOut, true);
  assert.deepEqual(config.bgm.audio, []);
});

test('BGM automatic-play opt-out is persisted and can be cleared', () => {
  const storage = new MemoryStorage();
  Object.defineProperty(globalThis, 'localStorage', { value: storage, configurable: true });
  try {
    assert.equal(initializeBgmPreference(true), false);
    disableBgmAutoplay(true);
    assert.equal($bgmAutoplayOptOut.get(), true);
    assert.equal(storage.getItem(BGM_AUTOPLAY_OPT_OUT_KEY), 'true');
    assert.equal(initializeBgmPreference(true), true);
    enableBgmAutoplay(true);
    assert.equal($bgmAutoplayOptOut.get(), false);
    assert.equal(storage.getItem(BGM_AUTOPLAY_OPT_OUT_KEY), null);
  } finally {
    Reflect.deleteProperty(globalThis, 'localStorage');
  }
});
