import { normalizeHexAddress, SimpleTypeTag, isVectorU8Tag } from './abi';

export type PrimitiveBcsType =
  | 'bool'
  | 'u8'
  | 'u16'
  | 'u32'
  | 'u64'
  | 'u128'
  | 'u256'
  | 'address'
  | 'string'
  | 'vector<u8>';

export type EncodeInput = string | number | bigint | boolean | Uint8Array;

export function hexToBytes(hex: string): Uint8Array {
  const normalized = hex.toLowerCase().startsWith('0x') ? hex.slice(2) : hex;
  if (normalized.length % 2 !== 0) {
    throw new Error('Hex string length must be even');
  }
  const bytes = new Uint8Array(normalized.length / 2);
  for (let i = 0; i < normalized.length; i += 2) {
    bytes[i / 2] = parseInt(normalized.slice(i, i + 2), 16);
  }
  return bytes;
}

export function bytesToHex(bytes: Uint8Array): string {
  return `0x${[...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')}`;
}

function toBytesLE(value: bigint, byteLength: number): Uint8Array {
  const result = new Uint8Array(byteLength);
  let temp = value;
  for (let i = 0; i < byteLength; i++) {
    result[i] = Number(temp & 0xffn);
    temp >>= 8n;
  }
  return result;
}

function fromBytesLE(bytes: Uint8Array): bigint {
  let result = 0n;
  for (let i = bytes.length - 1; i >= 0; i--) {
    result = (result << 8n) + BigInt(bytes[i]);
  }
  return result;
}

function encodeULEB128(value: number | bigint): Uint8Array {
  let num = BigInt(value);
  const out: number[] = [];
  do {
    let byte = Number(num & 0x7fn);
    num >>= 7n;
    if (num !== 0n) {
      byte |= 0x80;
    }
    out.push(byte);
  } while (num !== 0n);
  return Uint8Array.from(out);
}

function decodeULEB128(bytes: Uint8Array, offset = 0) {
  let value = 0n;
  let shift = 0n;
  let position = offset;
  while (position < bytes.length) {
    const byte = BigInt(bytes[position]);
    value |= (byte & 0x7fn) << shift;
    position += 1;
    if ((byte & 0x80n) === 0n) {
      return { value, nextOffset: position };
    }
    shift += 7n;
  }
  throw new Error('Incomplete ULEB128 data');
}

function ensureUint(value: EncodeInput): bigint {
  if (typeof value === 'number') {
    return BigInt(value);
  }
  if (typeof value === 'bigint') {
    return value;
  }
  if (typeof value === 'string') {
    if (value.startsWith('0x')) {
      return BigInt(value);
    }
    return BigInt(value);
  }
  throw new Error('Invalid numeric input');
}

export function encodePrimitive(type: PrimitiveBcsType, value: EncodeInput): Uint8Array {
  switch (type) {
    case 'bool':
      return new Uint8Array([value ? 1 : 0]);
    case 'u8':
      return new Uint8Array([Number(ensureUint(value) & 0xffn)]);
    case 'u16':
      return toBytesLE(ensureUint(value), 2);
    case 'u32':
      return toBytesLE(ensureUint(value), 4);
    case 'u64':
      return toBytesLE(ensureUint(value), 8);
    case 'u128':
      return toBytesLE(ensureUint(value), 16);
    case 'u256':
      return toBytesLE(ensureUint(value), 32);
    case 'address': {
      const normalized = normalizeHexAddress(String(value));
      const raw = hexToBytes(normalized);
      if (raw.length > 32) {
        throw new Error('Address length exceeds 32 bytes');
      }
      const padded = new Uint8Array(32);
      padded.set(raw, 32 - raw.length);
      return padded;
    }
    case 'string': {
      const text = typeof value === 'string' ? value : String(value);
      const utf8 = new TextEncoder().encode(text);
      const len = encodeULEB128(utf8.length);
      const out = new Uint8Array(len.length + utf8.length);
      out.set(len, 0);
      out.set(utf8, len.length);
      return out;
    }
    case 'vector<u8>': {
      let bytes: Uint8Array;
      if (value instanceof Uint8Array) {
        bytes = value;
      } else if (typeof value === 'string') {
        bytes = hexToBytes(value);
      } else {
        throw new Error('vector<u8> requires hex or Uint8Array input');
      }
      const len = encodeULEB128(bytes.length);
      const out = new Uint8Array(len.length + bytes.length);
      out.set(len, 0);
      out.set(bytes, len.length);
      return out;
    }
    default:
      throw new Error(`Unsupported BCS type: ${type}`);
  }
}

export function decodePrimitive(type: PrimitiveBcsType, bytes: Uint8Array) {
  switch (type) {
    case 'bool':
      return bytes[0] === 1;
    case 'u8':
      return Number(bytes[0]);
    case 'u16':
    case 'u32':
    case 'u64':
    case 'u128':
    case 'u256':
      return fromBytesLE(bytes);
    case 'address':
      return normalizeHexAddress(bytesToHex(bytes));
    case 'string': {
      const { value: length, nextOffset } = decodeULEB128(bytes);
      const slice = bytes.slice(nextOffset, nextOffset + Number(length));
      return new TextDecoder().decode(slice);
    }
    case 'vector<u8>': {
      const { value: length, nextOffset } = decodeULEB128(bytes);
      const slice = bytes.slice(nextOffset, nextOffset + Number(length));
      return bytesToHex(slice);
    }
    default:
      throw new Error(`Unsupported BCS type: ${type}`);
  }
}

export function toPrimitiveType(tag: SimpleTypeTag): PrimitiveBcsType | null {
  switch (tag.kind) {
    case 'bool':
    case 'u8':
    case 'u16':
    case 'u32':
    case 'u64':
    case 'u128':
    case 'u256':
      return tag.kind;
    case 'address':
      return 'address';
    case 'string':
      return 'string';
    case 'vector':
      return isVectorU8Tag(tag) ? 'vector<u8>' : null;
    default:
      return null;
  }
}
