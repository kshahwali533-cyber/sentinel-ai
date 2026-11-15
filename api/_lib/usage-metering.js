export function getUsageMonthStart(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error("A valid date is required.");
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1)).toISOString();
}

export function hasScanAllowance(used, limit) {
  const safeUsed = Number(used);
  const safeLimit = Number(limit);
  return Number.isFinite(safeUsed) && Number.isFinite(safeLimit) &&
    safeUsed >= 0 && safeLimit >= 1 && safeUsed < safeLimit;
}
