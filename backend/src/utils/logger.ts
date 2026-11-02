const stamp = () => new Date().toISOString();
export const logger = {
  info: (...a: unknown[]) => console.log(stamp(), '[info]', ...a),
  warn: (...a: unknown[]) => console.warn(stamp(), '[warn]', ...a),
  error: (...a: unknown[]) => console.error(stamp(), '[error]', ...a),
};
