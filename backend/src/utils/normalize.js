export function normalizeHeader(h) {
  return String(h || "")
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^\w]/g, "")
    .toLowerCase();
}

export function normalizeCellValue(v) {
  // Keep it safe and DB-friendly
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  if (s === "") return null;
  return s;
}
