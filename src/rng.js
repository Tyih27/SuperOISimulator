// Small seeded generator kept local to the combat kernel so replay does not depend on Math.random().
export function createRng(seed = 1) {
  let state = typeof seed === 'number' ? seed >>> 0 : hashSeed(String(seed));
  return {
    next() {
      state = (state + 0x6D2B79F5) >>> 0;
      let value = state;
      value = Math.imul(value ^ (value >>> 15), value | 1);
      value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
      return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    },
    pick(items) {
      if (items.length === 0) return undefined;
      return items[Math.floor(this.next() * items.length)];
    },
  };
}

function hashSeed(seed) {
  let value = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    value ^= seed.charCodeAt(index);
    value = Math.imul(value, 16777619);
  }
  return value >>> 0;
}
