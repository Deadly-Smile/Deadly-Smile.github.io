// Structural equality for comparing a Practice problem's actual vs. expected
// output — arrays/objects compared by value, not reference.
export function deepEqual(a, b) {
  if (Object.is(a, b)) return true;
  if (typeof a !== typeof b) return false;
  if (a === null || b === null) return false;
  if (typeof a !== "object") return false;

  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (!deepEqual(a[i], b[i])) return false;
    return true;
  }

  if (a instanceof Date || b instanceof Date) {
    return a instanceof Date && b instanceof Date && a.getTime() === b.getTime();
  }

  if (a instanceof Map || b instanceof Map) {
    if (!(a instanceof Map) || !(b instanceof Map) || a.size !== b.size) return false;
    for (const [k, v] of a) { if (!b.has(k) || !deepEqual(v, b.get(k))) return false; }
    return true;
  }

  if (a instanceof Set || b instanceof Set) {
    if (!(a instanceof Set) || !(b instanceof Set) || a.size !== b.size) return false;
    const bVals = [...b];
    for (const v of a) { if (!bVals.some(bv => deepEqual(v, bv))) return false; }
    return true;
  }

  const aKeys = Object.keys(a), bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;
  return aKeys.every(k => Object.prototype.hasOwnProperty.call(b, k) && deepEqual(a[k], b[k]));
}
