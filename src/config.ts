const env = process.env;

const required = (name: string, developmentDefault: string): string => {
  const value = env[name];
  if (value) return value;
  if (env.NODE_ENV === 'production') throw new Error(`Missing environment variable ${name}`);
  return developmentDefault;
};

export const config = {
  port: Number(env.PORT ?? 3001),
  rabbitmqUrl: env.RABBITMQ_URL ?? 'amqp://guest:guest@localhost:5672',
  jwtSecret: required('JWT_SECRET', 'local-development-secret'),
  jwtExpiresIn: env.JWT_EXPIRES_IN ?? '8h',
  admin: {
    email: env.ADMIN_EMAIL ?? 'admin@oficina.com',
    password: required('ADMIN_PASSWORD', 'admin123'),
  },
  smtp: {
    host: env.SMTP_HOST,
    port: Number(env.SMTP_PORT ?? 1025),
    user: env.SMTP_USER,
    password: env.SMTP_PASSWORD,
    from: env.MAIL_FROM ?? 'oficina@oficina.com',
  },
  newRelicEnabled: Boolean(env.NEW_RELIC_LICENSE_KEY),
};
