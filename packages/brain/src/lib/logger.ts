type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const currentLevel = (process.env.LOG_LEVEL as LogLevel) || 'info';

function shouldLog(level: LogLevel): boolean {
  return LEVELS[level] >= LEVELS[currentLevel];
}

function log(level: LogLevel, message: string, data?: Record<string, unknown>) {
  if (!shouldLog(level)) return;

  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    service: 'brain',
    ...data,
  };

  const line = JSON.stringify(entry);
  if (level === 'error') {
    console.error(line);
  } else {
    console.log(line);
  }
}

export const logger = {
  debug: (msg: string, data?: Record<string, unknown>) => log('debug', msg, data),
  info: (msg: string, data?: Record<string, unknown>) => log('info', msg, data),
  warn: (msg: string, data?: Record<string, unknown>) => log('warn', msg, data),
  error: (msg: string, data?: Record<string, unknown>) => log('error', msg, data),

  child: (defaults: Record<string, unknown>) => ({
    debug: (msg: string, data?: Record<string, unknown>) => log('debug', msg, { ...defaults, ...data }),
    info: (msg: string, data?: Record<string, unknown>) => log('info', msg, { ...defaults, ...data }),
    warn: (msg: string, data?: Record<string, unknown>) => log('warn', msg, { ...defaults, ...data }),
    error: (msg: string, data?: Record<string, unknown>) => log('error', msg, { ...defaults, ...data }),
  }),
};
