const { configureDatabaseEnv } = require('./database.cjs');

configureDatabaseEnv();

// Waline's PostgreSQL adapter logs full SQL statements and the connection URI
// at info level. Production comments can contain private text and the URI holds
// credentials, so keep only warnings and errors in the hosted service logs.
function disableVerboseLogs() {
  const logger = global.think?.logger;
  if (!logger) return;
  logger.info = () => undefined;
  logger.debug = () => undefined;
}

const Application = require('@waline/vercel');

// Requiring Waline creates the ThinkJS logger. Silence verbose output before
// constructing the application so startup cannot print a connection URI.
disableVerboseLogs();

const application = Application({
  plugins: [],
});

module.exports = (request, response) => {
  disableVerboseLogs();
  return application(request, response);
};
