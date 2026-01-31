import crypto from "crypto";

export function stableStringify(obj) {
  // sort keys so hashing is stable
  const allKeys = [];
  JSON.stringify(obj, (key, value) => {
    allKeys.push(key);
    return value;
  });
  allKeys.sort();

  return JSON.stringify(obj, allKeys);
}

export function sha256(str) {
  return crypto.createHash("sha256").update(str).digest("hex");
}
