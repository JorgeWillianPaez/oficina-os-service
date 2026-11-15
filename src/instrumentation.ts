import 'dotenv/config';

if (process.env.NEW_RELIC_LICENSE_KEY) {
  process.env.NEW_RELIC_APP_NAME ??= 'oficina-os-service';
  process.env.NEW_RELIC_DISTRIBUTED_TRACING_ENABLED ??= 'true';
  process.env.NEW_RELIC_APPLICATION_LOGGING_FORWARDING_ENABLED ??= 'true';
  process.env.NEW_RELIC_NO_CONFIG_FILE ??= 'true';
  require('newrelic');
}
