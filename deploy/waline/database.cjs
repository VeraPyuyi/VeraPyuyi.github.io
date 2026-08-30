const POSTGRES_PROTOCOLS = new Set(['postgres:', 'postgresql:']);
const WALINE_PG_KEYS = ['PG_HOST', 'PG_USER', 'PG_PASSWORD', 'PG_DB'];

function decode(value, label) {
  try {
    return decodeURIComponent(value);
  } catch {
    throw new TypeError(`DATABASE_URL contains an invalid ${label}`);
  }
}

/**
 * Neon injects DATABASE_URL by default, while Waline expects POSTGRES_* names.
 * Derive only missing values in memory so the connection secret is never copied
 * to source files or build logs.
 */
function configureDatabaseEnv(env = process.env) {
  const configuredPgKeys = WALINE_PG_KEYS.filter((name) => Boolean(env[name]));
  if (configuredPgKeys.length > 0) {
    if (configuredPgKeys.length !== WALINE_PG_KEYS.length) {
      const missing = WALINE_PG_KEYS.filter((name) => !env[name]);
      throw new TypeError(`Waline PG_* configuration is incomplete; missing ${missing.join(', ')}`);
    }

    env.PG_PORT ||= '5432';
    env.PG_SSL ||= 'true';
    return env;
  }

  if (!env.DATABASE_URL) return env;

  const connection = new URL(env.DATABASE_URL);
  if (!POSTGRES_PROTOCOLS.has(connection.protocol)) {
    throw new TypeError('DATABASE_URL must use the postgres or postgresql protocol');
  }

  const database = decode(connection.pathname.replace(/^\//, ''), 'database name');
  const derived = {
    POSTGRES_HOST: connection.hostname,
    POSTGRES_PORT: connection.port || '5432',
    POSTGRES_USER: decode(connection.username, 'user name'),
    POSTGRES_PASSWORD: decode(connection.password, 'password'),
    POSTGRES_DATABASE: database,
    POSTGRES_SSL: 'true',
  };

  for (const [name, value] of Object.entries(derived)) {
    if (!env[name] && value) env[name] = value;
  }

  return env;
}

module.exports = { configureDatabaseEnv };
