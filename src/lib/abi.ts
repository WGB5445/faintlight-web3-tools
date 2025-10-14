export type SimpleTypeTag =
  | { kind: 'bool' }
  | { kind: 'u8' }
  | { kind: 'u16' }
  | { kind: 'u32' }
  | { kind: 'u64' }
  | { kind: 'u128' }
  | { kind: 'u256' }
  | { kind: 'address' }
  | { kind: 'string' }
  | { kind: 'signer' }
  | { kind: 'vector'; inner: SimpleTypeTag }
  | { kind: 'struct'; fullName: string };

export interface ParsedModuleId {
  address: string;
  moduleName: string;
}

export function normalizeHexAddress(address: string) {
  if (!address) return address;
  const prefixed = address.startsWith('0x') ? address : `0x${address}`;
  return `0x${prefixed.slice(2).replace(/^0+/, '')}`;
}

export function parseModuleId(raw: string): ParsedModuleId | null {
  if (!raw.includes('::')) return null;
  const [address, moduleName] = raw.split('::');
  if (!address || !moduleName) return null;
  return {
    address: normalizeHexAddress(address.trim()),
    moduleName: moduleName.trim()
  };
}

const TRIM_PREFIXES = ['&mut ', '&', 'friend ', 'signer '];

export function simplifyType(typeTag: string): SimpleTypeTag {
  let cleaned = typeTag.trim();

  TRIM_PREFIXES.forEach((prefix) => {
    if (cleaned.startsWith(prefix)) {
      cleaned = cleaned.replace(prefix, '').trim();
    }
  });

  if (cleaned.startsWith('vector<') && cleaned.endsWith('>')) {
    const inner = cleaned.slice(7, -1);
    return { kind: 'vector', inner: simplifyType(inner) };
  }

  switch (cleaned) {
    case 'bool':
      return { kind: 'bool' };
    case 'u8':
      return { kind: 'u8' };
    case 'u16':
      return { kind: 'u16' };
    case 'u32':
      return { kind: 'u32' };
    case 'u64':
      return { kind: 'u64' };
    case 'u128':
      return { kind: 'u128' };
    case 'u256':
      return { kind: 'u256' };
    case 'address':
      return { kind: 'address' };
    case 'signer':
      return { kind: 'signer' };
    case '0x1::string::String':
    case 'string':
      return { kind: 'string' };
    default:
      return { kind: 'struct', fullName: cleaned };
  }
}

export function isVectorU8Tag(tag: SimpleTypeTag): boolean {
  return tag.kind === 'vector' && tag.inner.kind === 'u8';
}

export function getTypeLabel(tag: SimpleTypeTag): string {
  if (tag.kind === 'vector') {
    return `vector<${getTypeLabel(tag.inner)}>`;
  }
  if (tag.kind === 'struct') {
    return tag.fullName;
  }
  return tag.kind;
}
