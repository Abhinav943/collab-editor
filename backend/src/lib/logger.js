const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };
const threshold = LEVELS[process.env.LOG_LEVEL] ?? LEVELS.info;

function emit(level, args) {
  if (LEVELS[level] < threshold) return;
  const line = `[${new Date().toISOString()}] [${level.toUpperCase()}]`;
  (level === "debug" ? console.log : console[level])(line, ...args);
}

export const logger = {
  debug: (...a) => emit("debug", a),
  info: (...a) => emit("info", a),
  warn: (...a) => emit("warn", a),
  error: (...a) => emit("error", a),
};
