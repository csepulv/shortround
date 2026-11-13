/**
 * The command's args with each empty param the app holds a value for filled in, or `needs`: the params the app holds
 * none for (by label).
 */
export function fillFromApp(command, args) {
  const filled = { ...args };
  const needs = [];
  for (const [paramKey, param] of Object.entries(command.params)) {
    if (filled[paramKey] !== undefined || !param.currentOf) {
      continue;
    }
    const current = param.currentOf();
    if (current == null) {
      needs.push(param.label);
    } else {
      filled[paramKey] = argFor(param, current);
    }
  }
  return needs.length ? { needs } : { args: filled };
}

export const argFor = (param, value) => (param.list ? [value] : value);
