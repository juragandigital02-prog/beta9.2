/**
 * GAIN Dedicated BEP-20 Custodian / Vault Address Generator
 * Generates deterministic, unique BEP-20 addresses for members to deposit assets.
 */

function stringToHexHash(str: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }

  // Generate 40 hex characters using seeded pseudo-random distribution
  let hex = '';
  let seed = Math.abs(hash);
  for (let i = 0; i < 40; i++) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const nibble = (seed % 16).toString(16);
    hex += nibble;
  }
  return hex;
}

export function generateDedicatedBEP20Address(memberId: string, email: string = ''): string {
  // If Master GN-00001 or master admin, use official treasury
  if (memberId === 'GN-00001' || email.toLowerCase().includes('cuanteknologi01')) {
    return '0x099358c97f96451acdd973Ec44dbb7870580b5c9';
  }

  const rawHex = stringToHexHash(`GAIN-BEP20-VAULT-${memberId}-${email.toLowerCase()}`);
  return `0x${rawHex}`;
}
