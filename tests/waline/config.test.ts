import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import test from 'node:test';
import { parse } from 'yaml';
import {
  validateWalineImage,
  WALINE_MAX_GIF_BYTES,
  WALINE_MAX_SOURCE_BYTES,
} from '../../src/components/comment/providers/walineImageUploader';
import {
  resolveWalinePath,
  WALINE_EMOJI_PRESETS,
  WALINE_SITE_DEFAULTS,
} from '../../src/components/comment/providers/walineOptions';

const root = process.cwd();
const require = createRequire(import.meta.url);
const { configureDatabaseEnv } = require('../../deploy/waline/database.cjs') as {
  configureDatabaseEnv: (env: Record<string, string>) => Record<string, string>;
};

function read(path: string): string {
  return readFileSync(join(root, path), 'utf8');
}

test('Waline rich-media settings require login and disable duplicate page views', () => {
  const comment = parse(read('config/site.yaml')).comment;
  const config = comment.waline;

  assert.equal(comment.provider, 'waline');
  assert.equal(config.serverURL, 'https://pyuyi-comments.vercel.app');
  assert.equal(config.login, 'force');
  assert.equal(config.imageUploader, true);
  assert.equal(config.search, false);
  assert.equal(config.reaction, false);
  assert.equal(config.pageview, false);
  assert.equal(config.comment, false);
  assert.deepEqual(config.meta, []);
  assert.deepEqual(config.emoji, [...WALINE_EMOJI_PRESETS]);
  assert.equal(WALINE_SITE_DEFAULTS.login, 'force');
  assert.equal(WALINE_SITE_DEFAULTS.reaction, false);
});

test('Waline emoji and GIF pickers can escape the editor panel without horizontal overflow', () => {
  const styles = read('src/styles/components/waline.css');

  assert.match(styles, /\.wl-panel\s*{[^}]*overflow:\s*visible/s);
  assert.doesNotMatch(styles, /\.wl-panel\s*{[^}]*overflow:\s*hidden/s);
  assert.match(styles, /\.wl-emoji-popup,\s*\.wl-gif-popup\s*{[^}]*inset-inline-start:\s*0\.5rem/s);
  assert.match(styles, /\.wl-emoji-popup,\s*\.wl-gif-popup\s*{[^}]*width:\s*min\(calc\(100% - 1rem\), 32rem\)/s);
  assert.match(styles, /\.wl-emoji-popup,\s*\.wl-gif-popup\s*{[^}]*z-index:\s*20/s);
});

test('Waline uses stable content IDs across localized routes', () => {
  assert.equal(resolveWalinePath('paper:example', '/papers/example/'), 'paper:example');
  assert.equal(resolveWalinePath('paper:example', '/en/papers/example/'), 'paper:example');
  assert.equal(resolveWalinePath('  guestbook  ', '/guestbook/'), 'guestbook');
  assert.equal(resolveWalinePath(undefined, '/guestbook/'), '/guestbook/');
});

test('image validation blocks unsafe formats and oversized uploads', () => {
  assert.doesNotThrow(() => validateWalineImage(new File(['image'], 'photo.png', { type: 'image/png' })));
  assert.throws(() => validateWalineImage(new File(['<svg/>'], 'vector.svg', { type: 'image/svg+xml' })), /JPEG|PNG|WebP|GIF/);
  assert.throws(
    () => validateWalineImage(new File([new Uint8Array(WALINE_MAX_SOURCE_BYTES + 1)], 'photo.jpg', { type: 'image/jpeg' })),
    /8 MB/,
  );
  assert.throws(
    () => validateWalineImage(new File([new Uint8Array(WALINE_MAX_GIF_BYTES + 1)], 'sticker.gif', { type: 'image/gif' })),
    /512 KB/,
  );
});

test('Waline backend is pinned to a patched version and keeps credentials out of git', () => {
  const backendPackage = JSON.parse(read('deploy/waline/package.json'));
  const envExample = read('deploy/waline/.env.example');
  const gitignore = read('deploy/waline/.gitignore');
  const backendEntry = read('deploy/waline/index.cjs');

  assert.equal(backendPackage.dependencies['@waline/vercel'], '1.41.4');
  assert.equal(backendPackage.packageManager, 'pnpm@9.15.9');
  assert.equal(backendPackage.engines.node, '22.x');
  assert.match(envExample, /LOGIN=force/);
  assert.match(envExample, /SECURE_DOMAINS=verapyuyi\.github\.io/);
  assert.match(envExample, /DATABASE_URL=/);
  assert.match(envExample, /PG_USER=waline_app/);
  assert.match(envExample, /PG_PASSWORD=\n/);
  assert.match(envExample, /COMMENT_AUDIT=true/);
  assert.doesNotMatch(envExample, /(?:DATABASE_URL|PG_PASSWORD|POSTGRES_PASSWORD)=\S+/);
  assert.match(gitignore, /^\.env\.\*$/m);
  assert.match(gitignore, /^env\.txt$/m);
  assert.match(gitignore, /^!\.env\.example$/m);
  assert.match(backendEntry, /logger\.info = \(\) => undefined/);
  assert.match(backendEntry, /logger\.debug = \(\) => undefined/);
  assert.ok(backendEntry.indexOf('disableVerboseLogs();') < backendEntry.indexOf('const application = Application'));
});

test('Neon DATABASE_URL is converted to Waline variables without overwriting explicit values', () => {
  const env: Record<string, string> = {
    DATABASE_URL: 'postgresql://pyuyi:p%40ss@ep-example-pooler.neon.tech/neondb?sslmode=require',
    POSTGRES_PORT: '6543',
  };

  configureDatabaseEnv(env);

  assert.equal(env.POSTGRES_HOST, 'ep-example-pooler.neon.tech');
  assert.equal(env.POSTGRES_PORT, '6543');
  assert.equal(env.POSTGRES_USER, 'pyuyi');
  assert.equal(env.POSTGRES_PASSWORD, 'p@ss');
  assert.equal(env.POSTGRES_DATABASE, 'neondb');
  assert.equal(env.POSTGRES_SSL, 'true');
});

test('complete least-privilege PG settings take precedence without deriving owner credentials', () => {
  const env: Record<string, string> = {
    DATABASE_URL: 'postgresql://owner:secret@owner.example/neondb?sslmode=require',
    PG_HOST: 'app.example',
    PG_USER: 'waline_app',
    PG_PASSWORD: 'app-secret',
    PG_DB: 'neondb',
  };

  configureDatabaseEnv(env);

  assert.equal(env.PG_PORT, '5432');
  assert.equal(env.PG_SSL, 'true');
  assert.equal(env.POSTGRES_USER, undefined);
  assert.equal(env.POSTGRES_PASSWORD, undefined);
});

test('partial PG settings fail instead of mixing runtime and owner credentials', () => {
  assert.throws(
    () => configureDatabaseEnv({ DATABASE_URL: 'postgresql://owner:secret@owner.example/neondb', PG_USER: 'waline_app' }),
    /PG_\* configuration is incomplete; missing PG_HOST, PG_PASSWORD, PG_DB/,
  );
});
