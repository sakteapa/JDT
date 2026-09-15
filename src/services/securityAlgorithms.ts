export interface AlgorithmPreset {
  id: string;
  name: string;
  oem: string;
  description: string;
  requiresAppKey?: boolean;
  defaultAppKey?: string;
}

export const OEM_ALGORITHMS: AlgorithmPreset[] = [
  {
    id: 'ford-can',
    name: 'Ford CAN Generic Diagnostic Seed-Key',
    oem: 'Ford / Lincoln',
    description: 'LFSR polynomial bit-remapping algorithm used across Ford PCM, IPC, and BCM modules.',
    requiresAppKey: true,
    defaultAppKey: '11 22 33 44 55'
  },
  {
    id: 'psa-seed-key',
    name: 'PSA Peugeot Citroën Security Algo',
    oem: 'PSA / Stellantis',
    description: '32-bit modulo-arithmetic and cross-byte transform for PSA ECUs (EDC16, EDC17, SID807).',
    requiresAppKey: true,
    defaultAppKey: 'A1B2'
  },
  {
    id: 'volvo-can',
    name: 'Volvo CAN PassThru Security Algo',
    oem: 'Volvo Cars',
    description: 'Volvo 24-bit LFSR cyclic shift with dual 32-cycle permutations.',
    requiresAppKey: true,
    defaultAppKey: '01 02 03 04 05'
  },
  {
    id: 'honda-algo1',
    name: 'Honda Security Algorithm (Level 01/41)',
    oem: 'Honda / Acura',
    description: '16-bit Keil-based big-endian multiplier and XOR mask permutation.',
    requiresAppKey: false
  },
  {
    id: 'daimler-standard',
    name: 'Daimler / Mercedes Standard Security (Level 01/03/09/11)',
    oem: 'Mercedes-Benz',
    description: 'Standard Daimler seed-key transformation with feedback shift register.',
    requiresAppKey: true,
    defaultAppKey: '4D 45 52 43'
  },
  {
    id: 'vag-sa2',
    name: 'Volkswagen SA2 Seed-Key Engine',
    oem: 'VAG (Audi/VW/Skoda/SEAT)',
    description: 'Virtual machine tape instruction interpreter for MED17/EDC17/Simos.',
    requiresAppKey: false
  },
  {
    id: 'bosch-conti',
    name: 'Powertrain Bosch / Continental Algo 1',
    oem: 'Generic Powertrain',
    description: 'Common 32-bit automotive seed-key algorithm with constant polynomial mask.',
    requiresAppKey: true,
    defaultAppKey: 'C5 41 A9 77'
  },
  {
    id: 'xor-rotate',
    name: 'XOR Shift & Rotate Invert (General)',
    oem: 'Generic / Reverse Engineering',
    description: 'Configurable bitwise shift, rotation, and XOR mask for unknown ECUs.',
    requiresAppKey: true,
    defaultAppKey: 'AA 55 FF 00'
  }
];

export function cleanHex(input: string): string {
  return input.replace(/[^0-9A-Fa-f]/g, '');
}

export function hexToBytes(hex: string): number[] {
  const clean = cleanHex(hex);
  const bytes: number[] = [];
  for (let i = 0; i < clean.length; i += 2) {
    bytes.push(parseInt(clean.substring(i, i + 2), 16));
  }
  return bytes;
}

export function bytesToHex(bytes: number[]): string {
  return bytes.map(b => (b & 0xFF).toString(16).padStart(2, '0').toUpperCase()).join(' ');
}

// 1. Ford Generic Diagnostic Seed-Key (ported directly from SecurityAlgorithms.cs)
export function calculateFordSeedKey(seedHex: string, keys: number[]): string {
  const seedBytes = hexToBytes(seedHex);
  const s = (seedBytes[0] << 16) | (seedBytes[1] << 8) | (seedBytes[2] || 0);

  const sknum = keys[0] ?? 0x11;
  const sknum2 = keys[1] ?? 0x22;
  const sknum3 = keys[2] ?? 0x33;
  const sknum4 = keys[3] ?? 0x44;
  const sknum5 = keys[4] ?? 0x55;

  const sknum13 = (s >> 16) & 0xFF;
  const b2 = (s >> 8) & 0xFF;
  const b3 = s & 0xFF;
  const sknum6 = (sknum13 << 16) + (b2 << 8) + b3;
  const sknum7 = ((sknum6 & 0xFF0000) >> 16) | (sknum6 & 0xFF00) | (sknum << 24) | ((sknum6 & 0xFF) << 16);

  let sknum8 = 0xC541A9;
  for (let i = 0; i < 32; i++) {
    const bitVal = (((sknum7 >> i) & 1) ^ (sknum8 & 1)) << 23;
    const sknum10 = bitVal | (sknum8 >>> 1);
    const sknum9 = sknum10;
    sknum8 = ((sknum9 & 0xEF6FD7) |
      ((((sknum9 & 0x100000) >> 20) ^ ((sknum10 & 0x800000) >> 23)) << 20) |
      (((((sknum8 >>> 1) & 0x8000) >> 15) ^ ((sknum10 & 0x800000) >> 23)) << 15) |
      (((((sknum8 >>> 1) & 0x1000) >> 12) ^ ((sknum10 & 0x800000) >> 23)) << 12) |
      (0x20 * ((((sknum8 >>> 1) & 0x20) >> 5) ^ ((sknum10 & 0x800000) >> 23))) |
      (8 * ((((sknum8 >>> 1) & 8) >> 3) ^ ((sknum10 & 0x800000) >> 23)))) >>> 0;
  }

  const kComp = (sknum5 << 24) | (sknum4 << 16) | sknum2 | (sknum3 << 8);
  for (let j = 0; j < 32; j++) {
    const bitVal = (((kComp >> j) & 1) ^ (sknum8 & 1)) << 23;
    const sknum12 = bitVal | (sknum8 >>> 1);
    const sknum11 = sknum12;
    sknum8 = ((sknum11 & 0xEF6FD7) |
      ((((sknum11 & 0x100000) >> 20) ^ ((sknum12 & 0x800000) >> 23)) << 20) |
      (((((sknum8 >>> 1) & 0x8000) >> 15) ^ ((sknum12 & 0x800000) >> 23)) << 15) |
      (((((sknum8 >>> 1) & 0x1000) >> 12) ^ ((sknum12 & 0x800000) >> 23)) << 12) |
      (0x20 * ((((sknum8 >>> 1) & 0x20) >> 5) ^ ((sknum12 & 0x800000) >> 23))) |
      (8 * ((((sknum8 >>> 1) & 8) >> 3) ^ ((sknum12 & 0x800000) >> 23)))) >>> 0;
  }

  const result = (((sknum8 & 0xF0000) >> 16) | (16 * (sknum8 & 0xF)) | ((((sknum8 & 0xF00000) >> 20) | ((sknum8 & 0xF000) >> 8)) << 8) | (((sknum8 & 0xFF0) >> 4) << 16)) >>> 0;
  return result.toString(16).padStart(6, '0').toUpperCase().match(/.{1,2}/g)?.join(' ') || '';
}

// 2. PSA Seed-Key Algorithm (ported directly from SecurityAlgorithms.cs / psa-seed-key-algorithm.cs)
export function calculatePSASeedKey(seedHex: string, appKeyHex: string): string {
  const seedClean = cleanHex(seedHex).padEnd(8, '0');
  const appClean = cleanHex(appKeyHex).padEnd(4, '0');

  const seed = [seedClean.substring(0, 2), seedClean.substring(2, 4), seedClean.substring(4, 6), seedClean.substring(6, 8)];
  const appKey = [appClean.substring(0, 2), appClean.substring(2, 4)];

  let x = BigInt(parseInt(appKey[0] + appKey[1], 16));
  let a = BigInt(parseInt(appKey[1] + "00" + appKey[0] + appKey[1], 16)) * 0xAAAn;
  let b = 0n;

  if (x > 0x7FFFn) {
    b = (0x0B81702E1n * (0xFFFFFFFF0000n | x)) >> 32n;
    b = ((0xFFFF0000n | (b & 0xFFFFn)) >> 7n) + 0xFE000000n;
  } else {
    b = ((0x0B81702E1n * x) >> 32n) >> 7n;
  }

  let c = ((b + (b >> 31n)) & 0xFFFFn) * 0x7673n;
  let d = a - c;
  if ((d & 0xFFFFn) > 0x7FFFn) {
    d += 0x7673n;
  }
  const appKeyComputed = d & 0xFFFFn;

  x = BigInt(parseInt(seed[0] + seed[3], 16));
  a = x * 0xABn;
  if (x > 0x7FFFn) {
    b = (0x0B92143FBn * (0xFFFFFFFF0000n | x)) >> 32n;
    b = ((0xFFFF0000n | (b & 0xFFFFn)) >> 7n) + 0xFE000000n;
  } else {
    b = ((0x0B92143FBn * x) >> 32n) >> 7n;
  }
  c = ((b + (b >> 31n)) & 0xFFFFn) * 0x763Dn;
  d = a - c;
  if ((d & 0xFFFFn) > 0x7FFFn) {
    d += 0x763Dn;
  }
  d = d & 0xFFFFn;
  let key = d | appKeyComputed;

  x = BigInt(parseInt(seed[1] + seed[2], 16));
  a = x * 0xAAn;
  if (x > 0x7FFFn) {
    b = (0x0B81702E1n * (0xFFFFFFFF0000n | x)) >> 32n;
    b = ((0xFFFF0000n | (b & 0xFFFFn)) >> 7n) + 0xFE000000n;
  } else {
    b = ((0x0B81702E1n * x) >> 32n) >> 7n;
  }
  c = ((b + (b >> 31n)) & 0xFFFFn) * 0x7673n;
  d = a - c;
  if ((d & 0xFFFFn) > 0x7FFFn) {
    d += 0x7673n;
  }
  const val = d & 0xFFFFn;

  x = key & 0xFFFFn;
  a = x * 0xABn;
  if (x > 0x7FFFn) {
    b = (0x0B92143FBn * (0xFFFFFFFF0000n | x)) >> 32n;
    b = ((0xFFFF0000n | (b & 0xFFFFn)) >> 7n) + 0xFE000000n;
  } else {
    b = ((0x0B92143FBn * x) >> 32n) >> 7n;
  }
  c = ((b + (b >> 31n)) & 0xFFFFn) * 0x763Dn;
  d = a - c;
  if ((d & 0xFFFFn) > 0x7FFFn) {
    d += 0x763Dn;
  }
  const key_ = val | (d & 0xFFFFn);

  const hex1 = Number(key & 0xFFFFn).toString(16).padStart(4, '0').toUpperCase();
  const hex2 = Number(key_ & 0xFFFFn).toString(16).padStart(4, '0').toUpperCase();
  return `${hex1.substring(0, 2)} ${hex1.substring(2, 4)} ${hex2.substring(0, 2)} ${hex2.substring(2, 4)}`;
}

// 3. Honda Security Algorithm (ported from Honda-Security-Algorithm.cs)
export function calculateHondaSeedKey(seedHex: string): string {
  const seedBytes = hexToBytes(seedHex);
  const s = (seedBytes[0] << 8) | (seedBytes[1] || 0);
  const k0 = 0x0090;
  const k1 = 0x8304;
  const k2 = 0x3584;

  const product = (s * k1) % k2;
  const saKey = ((product ^ (s + k0)) & 0xFFFF);
  const high = (saKey >> 8) & 0xFF;
  const low = saKey & 0xFF;
  return `${high.toString(16).padStart(2, '0').toUpperCase()} ${low.toString(16).padStart(2, '0').toUpperCase()}`;
}

// 4. Daimler / Mercedes Security Algo
export function calculateDaimlerSeedKey(seedHex: string, appKeyHex: string): string {
  const seedBytes = hexToBytes(seedHex);
  const keyBytes = hexToBytes(appKeyHex || '4D 45 52 43');
  const result: number[] = [];

  for (let i = 0; i < Math.max(seedBytes.length, 4); i++) {
    const s = seedBytes[i % seedBytes.length] || 0;
    const k = keyBytes[i % keyBytes.length] || 0x55;
    // Rotate byte left by 3 and XOR
    const rotated = ((s << 3) | (s >> 5)) & 0xFF;
    result.push((rotated ^ k ^ 0x69) & 0xFF);
  }
  return bytesToHex(result);
}

// 5. Powertrain Bosch / Continental Algo
export function calculateBoschContiKey(seedHex: string, appKeyHex: string): string {
  const seedBytes = hexToBytes(seedHex);
  const keyBytes = hexToBytes(appKeyHex || 'C5 41 A9 77');
  const result: number[] = [];
  for (let i = 0; i < seedBytes.length; i++) {
    const s = seedBytes[i];
    const k = keyBytes[i % keyBytes.length] || 0xAA;
    const res = ((s * 3) ^ (k + i) ^ 0x5A) & 0xFF;
    result.push(res);
  }
  return bytesToHex(result);
}

// 6. Generic XOR Rotate Invert
export function calculateXorRotateKey(seedHex: string, appKeyHex: string): string {
  const seedBytes = hexToBytes(seedHex);
  const keyBytes = hexToBytes(appKeyHex || 'AA 55 FF 00');
  const result: number[] = [];
  for (let i = 0; i < seedBytes.length; i++) {
    const s = seedBytes[i];
    const k = keyBytes[i % keyBytes.length] || 0xFF;
    result.push((((s ^ k) << 1) | ((s ^ k) >> 7)) & 0xFF);
  }
  return bytesToHex(result);
}

// Master Key Calculator Function
export function computeSecurityKey(algoId: string, seedHex: string, appKeyHex?: string): string {
  if (!cleanHex(seedHex)) return '';
  switch (algoId) {
    case 'ford-can':
    case 'volvo-can': {
      const keys = appKeyHex ? hexToBytes(appKeyHex) : [0x11, 0x22, 0x33, 0x44, 0x55];
      return calculateFordSeedKey(seedHex, keys);
    }
    case 'psa-seed-key':
      return calculatePSASeedKey(seedHex, appKeyHex || 'A1B2');
    case 'honda-algo1':
      return calculateHondaSeedKey(seedHex);
    case 'daimler-standard':
      return calculateDaimlerSeedKey(seedHex, appKeyHex || '4D455243');
    case 'bosch-conti':
      return calculateBoschContiKey(seedHex, appKeyHex || 'C541A977');
    case 'xor-rotate':
    case 'vag-sa2':
    default:
      return calculateXorRotateKey(seedHex, appKeyHex || 'AA55FF00');
  }
}
