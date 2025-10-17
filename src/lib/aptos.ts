import { Account, AccountAddress, AccountAddressInput, Aptos, AptosConfig, Bool, Ed25519PrivateKey, EntryFunctionArgument, EntryFunctionArgumentTypes, getAptosFullNode, Hex, InputEntryFunctionData, LedgerVersionArg, MoveModuleBytecode, MoveOption, MoveString, MoveVector, Network, SimpleEntryFunctionArgumentTypes, U128, U16, U256, U32, U64, U8 } from '@aptos-labs/ts-sdk';
import { Buffer } from 'buffer';

export interface SubmitEntryFunctionParams {
  senderPrivateKeyHex: string;
  restUrl: string;
  networkId: 'mainnet' | 'testnet' | 'devnet' | 'custom';
  data: InputEntryFunctionData;
}

export function resolveNetworkConfig(networkId: SubmitEntryFunctionParams['networkId'], restUrl: string) {
  switch (networkId) {
    case 'mainnet':
      return new AptosConfig({ network: Network.MAINNET, fullnode: restUrl });
    case 'testnet':
      return new AptosConfig({ network: Network.TESTNET, fullnode: restUrl });
    case 'devnet':
      return new AptosConfig({ network: Network.DEVNET, fullnode: restUrl });
    case 'custom':
    default:
      return new AptosConfig({ fullnode: restUrl });
  }
}

export async function getModule(args: {
  aptosConfig: AptosConfig;
  accountAddress: AccountAddressInput;
  moduleName: string;
  options?: LedgerVersionArg;
}): Promise<MoveModuleBytecode> {
  const { aptosConfig, accountAddress, moduleName, options } = args;

  const { data } = await getAptosFullNode<{}, MoveModuleBytecode>({
    aptosConfig,
    originMethod: "getModule",
    path: `accounts/${AccountAddress.from(accountAddress).toString()}/module/${moduleName}`,
    params: { ledger_version: options?.ledgerVersion },
  });
  return data;
}


export async function submitEntryFunction({ senderPrivateKeyHex, restUrl, networkId, data }: SubmitEntryFunctionParams) {
  const config = resolveNetworkConfig(networkId, restUrl);
  const aptos = new Aptos(config);

  const privateKey = new Ed25519PrivateKey(senderPrivateKeyHex);
  const account = Account.fromPrivateKey({ privateKey });

  const transaction = await aptos.transaction.build.simple({
    sender: account.accountAddress.toString(),
    data
  });

  const pendingTransaction = await aptos.signAndSubmitTransaction({ signer: account, transaction });
  const executed = await aptos.waitForTransaction({ transactionHash: pendingTransaction.hash });

  return executed;
}

function ensureHexPrefix(hash: string) {
  return hash.startsWith('0x') ? hash : `0x${hash}`;
}

const EXPLORER_BASE_BY_NETWORK: Record<string, string> = {
  mainnet: 'https://explorer.aptoslabs.com/txn/',
  testnet: 'https://explorer.aptoslabs.com/txn/',
  devnet: 'https://explorer.aptoslabs.com/txn/'
};

const EXPLORER_QUERY_BY_NETWORK: Record<string, string> = {
  mainnet: '?network=mainnet',
  testnet: '?network=testnet',
  devnet: '?network=devnet'
};

export function getExplorerTxUrl({
  preferredNetwork,
  fallbackNetwork,
  hash
}: {
  preferredNetwork?: string | null;
  fallbackNetwork: SubmitEntryFunctionParams['networkId'];
  hash: string;
}) {
  const normalizedHash = ensureHexPrefix(hash);

  const primary = preferredNetwork?.toLowerCase();
  const primaryBase = primary ? EXPLORER_BASE_BY_NETWORK[primary] : undefined;
  const primaryQuery = primary ? EXPLORER_QUERY_BY_NETWORK[primary] : undefined;

  if (primaryBase) {
    return `${primaryBase}${normalizedHash}${primaryQuery ?? ''}`;
  }

  const fallbackKey = fallbackNetwork !== 'custom' ? fallbackNetwork : 'mainnet';
  const fallbackBase = EXPLORER_BASE_BY_NETWORK[fallbackKey];
  const fallbackQuery = EXPLORER_QUERY_BY_NETWORK[fallbackKey];

  if (!fallbackBase) return null;
  return `${fallbackBase}${normalizedHash}${fallbackQuery ?? ''}`;
}

export async function waitForTransaction(restUrl: string, hash: string) {
  const config = new AptosConfig({ fullnode: restUrl });
  const aptos = new Aptos(config);
  return aptos.waitForTransaction({ transactionHash: ensureHexPrefix(hash) });
}


export type TypeTag =
  | { kind: "bool" | "u8" | "u16" | "u32" | "u64" | "u128" | "u256" | "address" }
  | { kind: "vector"; elem: TypeTag }
  | { kind: "option"; elem: TypeTag } // 0x1::option::Option<T> 的语义
  | { kind: "string" }                // 0x1::string::String
  | { kind: "generic"; index: number } // T0/T1/...
  | { kind: "struct"; address: string; module: string; name: string; typeArgs: TypeTag[] };

// ---------- 解析：TypeTag 字符串 -> AST ----------
export function parseTypeTagLite(input: string): TypeTag {
  const s = input.replace(/\s+/g, "").replace(/^&mut\s+/, "").replace(/^&/, "");
  let i = 0;

  function peek() { return s[i]; }
  function eat(ch?: string) {
    if (ch && s[i] !== ch) throw err(`Expected '${ch}'`);
    return s[i++];
  }
  function err(msg: string): Error {
    const cursor = `${s}\n${" ".repeat(i)}^`;
    return new Error(`${msg} at ${i}:\n${cursor}`);
  }
  function isIdentChar(c: string) {
    return /[A-Za-z0-9_]/.test(c);
  }

  function parseType(): TypeTag {
    // vector<...>
    if (s.startsWith("vector<", i)) {
      i += "vector<".length;
      const t = parseType();
      if (eat(">" as any) !== ">") throw err("Missing '>' for vector");
      return { kind: "vector", elem: t };
    }

    // primitives
    const prims = ["bool","u8","u16","u32","u64","u128","u256","address"] as const;
    for (const p of prims) {
      if (s.startsWith(p, i)) { i += p.length; return { kind: p }; }
    }

    // generic T / T0 / T1 ...
    if (s[i] === "T") {
      i++;
      let num = "";
      while (/\d/.test(peek() ?? "")) num += eat();
      const index = num === "" ? 0 : parseInt(num, 10);
      return { kind: "generic", index };
    }

    // struct-like path: addr_or_name::module::name<...>?
    const pathStart = i;
    // address may start with 0x...
    if (s.startsWith("0x", i)) {
      i += 2;
      let hex = "";
      while (/[0-9a-fA-F]/.test(peek() ?? "")) hex += eat();
      if (!s.startsWith("::", i)) throw err("Expect '::' after address");
      i += 2;
      const module = parseIdent();
      if (!s.startsWith("::", i)) throw err("Expect '::' after module");
      i += 2;
      const name = parseIdent();

      // special cases mapping:
      if (hex.toLowerCase() === "1" && module === "option" && name === "Option") {
        const ta = maybeTypeArgs();
        if (ta.length !== 1) throw err("Option<T> expects 1 type arg");
        return { kind: "option", elem: ta[0] };
      }
      if (hex.toLowerCase() === "1" && module === "string" && name === "String") {
        // 0x1::string::String
        maybeTypeArgs(); // should be none
        return { kind: "string" };
      }

      // object::Object<T> —— 视作 struct（如果你要特殊处理，可在 encodeArg 里定制）
      const typeArgs = maybeTypeArgs();
      return { kind: "struct", address: "0x" + hex.toLowerCase(), module, name, typeArgs };
    } else {
      // 也允许非 0x 开头的命名空间（若你有自家标准库别名）
      const ns = parseIdent();
      if (!s.startsWith("::", i)) throw err("Expect '::' after namespace");
      i += 2;
      const module = parseIdent();
      if (!s.startsWith("::", i)) throw err("Expect '::' after module");
      i += 2;
      const name = parseIdent();

      // 兼容 "std::string::String" 或别名（如果你的链做了别名映射，在此加判断）
      if ((ns === "std" || ns === "aptos_std") && module === "string" && name === "String") {
        maybeTypeArgs();
        return { kind: "string" };
      }
      if ((ns === "std" || ns === "aptos_std") && module === "option" && name === "Option") {
        const ta = maybeTypeArgs();
        if (ta.length !== 1) throw err("Option<T> expects 1 type arg");
        return { kind: "option", elem: ta[0] };
      }

      const typeArgs = maybeTypeArgs();
      return { kind: "struct", address: ns, module, name, typeArgs };
    }

    function parseIdent(): string {
      if (!isIdentChar(peek() ?? "")) throw err("Expect identifier");
      let id = "";
      while (isIdentChar(peek() ?? "")) id += eat();
      return id;
    }
  }

  function maybeTypeArgs(): TypeTag[] {
    if (peek() !== "<") return [];
    eat("<");
    const out: TypeTag[] = [];
    for (;;) {
      out.push(parseType());
      if (peek() === ">") { eat(">"); break; }
      if (peek() !== ",") throw err("Expect ',' or '>' in type args");
      eat(",");
    }
    return out;
  }

  const t = parseType();
  if (i !== s.length) throw err("Trailing characters");
  return t;
}



// ---------- 泛型替换 ----------
export function substituteGenerics(tag: TypeTag, typeArgs: TypeTag[]): TypeTag {
  switch (tag.kind) {
    case "generic": {
      const rep = typeArgs[tag.index];
      if (!rep) throw new Error(`Missing type arg for T${tag.index}`);
      return rep;
    }
    case "vector": return { kind: "vector", elem: substituteGenerics(tag.elem, typeArgs) };
    case "option": return { kind: "option", elem: substituteGenerics(tag.elem, typeArgs) };
    case "struct": return {
      kind: "struct",
      address: tag.address, module: tag.module, name: tag.name,
      typeArgs: tag.typeArgs.map(t => substituteGenerics(t, typeArgs)),
    };
    default: return tag;
  }
}

// ---------- BCS 基础 ----------
function concatBytes(chunks: Uint8Array[]): Uint8Array {
  const len = chunks.reduce((a, b) => a + b.length, 0);
  const out = new Uint8Array(len);
  let o = 0;
  for (const c of chunks) { out.set(c, o); o += c.length; }
  return out;
}

function uleb128(n: number): Uint8Array {
  if (!Number.isSafeInteger(n) || n < 0) throw new Error(`uleb128: invalid ${n}`);
  const bytes: number[] = [];
  do {
    let b = n & 0x7f;
    n >>>= 7;
    if (n !== 0) b |= 0x80;
    bytes.push(b);
  } while (n !== 0);
  return Uint8Array.from(bytes);
}

function leFromNumber(n: number, byteLen: number): Uint8Array {
  if (!Number.isSafeInteger(n) || n < 0) throw new Error(`Range error for u${byteLen * 8}: ${n}`);
  const max = 2 ** (byteLen * 8) - 1;
  if (n > max) throw new Error(`Overflow for u${byteLen * 8}: ${n}`);
  const out = new Uint8Array(byteLen);
  for (let i = 0; i < byteLen; i++) { out[i] = n & 0xff; n >>>= 8; }
  return out;
}

function leFromBigint(x: bigint, byteLen: number): Uint8Array {
  if (x < 0n) throw new Error("negative bigint");
  const out = new Uint8Array(byteLen);
  let v = x;
  for (let i = 0; i < byteLen; i++) { out[i] = Number(v & 0xffn); v >>= 8n; }
  if (v !== 0n) throw new Error(`Overflow for u${byteLen * 8}`);
  return out;
}

function toBigint(v: unknown): bigint {
  if (typeof v === "bigint") return v;
  if (typeof v === "number") {
    if (!Number.isFinite(v) || v < 0) throw new Error("bigint from number: invalid");
    return BigInt(v);
  }
  if (typeof v === "string") {
    const s = v.trim();
    if (/^0x[0-9a-fA-F]+$/.test(s)) return BigInt(s);
    if (/^\d+$/.test(s)) return BigInt(s);
  }
  throw new Error(`Cannot convert to bigint: ${String(v)}`);
}

function hexToBytes(hex: string): Uint8Array {
  let h = hex.toLowerCase();
  if (h.startsWith("0x")) h = h.slice(2);
  if (h.length % 2 === 1) h = "0" + h;
  if (!/^[0-9a-f]+$/.test(h)) throw new Error("Invalid hex");
  const out = new Uint8Array(h.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(h.slice(2 * i, 2 * i + 2), 16);
  return out;
}

function addressTo32Bytes(addr: string | Uint8Array): Uint8Array {
  if (addr instanceof Uint8Array) {
    if (addr.length !== 32) throw new Error("address bytes must be 32");
    return new Uint8Array(addr);
  }
  const b = hexToBytes(addr);
  if (b.length > 32) throw new Error("address too long");
  const out = new Uint8Array(32);
  out.set(b, 32 - b.length); // 左侧零填充
  return out;
}

const te = new TextEncoder();
const td = new TextDecoder();

// ---------- 核心：值编码 ----------
export function encodeArg(tag: TypeTag, value: unknown): Uint8Array {
  switch (tag.kind) {
    case "bool": {
      if (typeof value !== "boolean") throw shape("boolean", value);
      return Uint8Array.of(value ? 1 : 0);
    }
    case "u8": {
      if (typeof value !== "number") throw shape("number(0..255)", value);
      return leFromNumber(value, 1);
    }
    case "u16": {
      if (typeof value !== "number") throw shape("number", value);
      return leFromNumber(value, 2);
    }
    case "u32": {
      if (typeof value !== "number") throw shape("number", value);
      return leFromNumber(value, 4);
    }
    case "u64": return leFromBigint(toBigint(value), 8);
    case "u128": return leFromBigint(toBigint(value), 16);
    case "u256": return leFromBigint(toBigint(value), 32);

    case "address": {
      if (typeof value !== "string" && !(value instanceof Uint8Array)) {
        throw shape("address hex string or 32 bytes", value);
      }
      return addressTo32Bytes(value as any);
    }

    case "string": {
      if (typeof value !== "string") throw shape("string (UTF-8)", value);
      // BCS(String) == BCS(vector<u8>) of UTF-8
      const bytes = te.encode(value);
      return concatBytes([uleb128(bytes.length), bytes]);
    }

    case "vector": {
      // vector<u8> 的多形输入优化
      if (tag.elem.kind === "u8") {
        const bytes = coerceBytes(value);
        return concatBytes([uleb128(bytes.length), bytes]);
      }
      // 一般 vector<T>
      if (!Array.isArray(value)) throw shape("Array", value);
      const enc = (value as unknown[]).map(v => encodeArg(tag.elem, v));
      const flat = concatBytes(enc);
      return concatBytes([uleb128(enc.length), flat]);
    }

    case "option": {
      // BCS 表现：vector<T>，长度 0 => None；长度 1 => Some
      if (value === null || value === undefined) {
        return uleb128(0); // 空向量，无元素
      }
      const inner = encodeArg(tag.elem, value);
      return concatBytes([uleb128(1), inner]);
    }

    case "generic":
      throw new Error("Generic must be substituted before encoding");

    case "struct": {
      // 这里默认不支持“一般结构体”的值直传（除非你愿意按字段顺序编码）
      // 常见可映射：
      //   - 0x1::object::Object<T> 想用 “对象ID地址” 作为入参时，可在这里特殊化为 address 编码
      //   - 其他自定义 struct 若在 entry 参数中出现，必须知道确切字段顺序和类型（BCS 顺序编码）
      const fq = `${tag.address}::${tag.module}::${tag.name}`;
      if (tag.address.toLowerCase() === "0x1" && tag.module === "object" && tag.name === "Object") {
        // 将 Object<T> 入参视为对象 ID（address）
        if (typeof value !== "string" && !(value instanceof Uint8Array)) {
          throw shape("object id (address)", value);
        }
        return addressTo32Bytes(value as any);
      }
      if (tag.address.toLowerCase() === "0x1" && tag.module === "string" && tag.name === "String") {
        // 容错：等价 string 处理
        if (typeof value !== "string") throw shape("string", value);
        const bytes = te.encode(value);
        return concatBytes([uleb128(bytes.length), bytes]);
      }
      throw new Error(`Unsupported struct in args: ${fq}. You can extend 'encodeArg' to handle it.`);
    }
  }

  function shape(exp: string, got: unknown) {
    return new Error(`Argument shape error: expect ${exp}, got ${JSON.stringify(got)}`);
  }

  function coerceBytes(v: unknown): Uint8Array {
    if (v instanceof Uint8Array) return v;
    if (typeof v === "string") return hexToBytes(v);
    if (Array.isArray(v)) {
      if (!v.every(x => typeof x === "number" && Number.isInteger(x) && x >= 0 && x <= 255)) {
        throw new Error("vector<u8> number[] must be 0..255");
      }
      return Uint8Array.from(v);
    }
    throw new Error("vector<u8> expects hex string / Uint8Array / number[]");
  }
}

// ---------- 顶层：把(参数类型/类型实参/JS值) => BCS ----------
export function prepareBcsArgs(opts: {
  paramTypeStrings: string[];
  args: unknown[];
  typeArgStrings?: string[]; // 例如 ["0x1::aptos_coin::AptosCoin"]，可为空
}): Uint8Array[] {
  const { paramTypeStrings, args, typeArgStrings = [] } = opts;
  if (paramTypeStrings.length !== args.length) {
    throw new Error(`Argument count mismatch: expect ${paramTypeStrings.length}, got ${args.length}`);
  }
  const paramTags = paramTypeStrings.map(parseTypeTagLite);
  const typeArgs = typeArgStrings.map(parseTypeTagLite);

  const replaced = paramTags.map(t => substituteGenerics(t, typeArgs));
  return replaced.map((t, i) => encodeArg(t, args[i]));
}

export function bytesToHex(b: Uint8Array): string {
  return "0x" + Array.from(b).map(x => x.toString(16).padStart(2, "0")).join("");
}

// 小工具：确保有足够的字节
function need(data: Uint8Array, offset: number, bytes: number) {
  if (offset + bytes > data.length) {
    throw new Error(`BCS underflow: need ${bytes} bytes at ${offset}, but only ${data.length - offset} left`);
  }
}

function readULEB128(data: Uint8Array, offset: number): [number, number] {
  let result = 0, shift = 0, o = offset;
  for (let i = 0; i < 5; i++) { // 足够覆盖向量长度/元素数（一般很小）
    need(data, o, 1);
    const byte = data[o++];
    result |= (byte & 0x7f) << shift;
    if ((byte & 0x80) === 0) return [result, o];
    shift += 7;
  }
  throw new Error("ULEB128 too large");
}

function readNumberLE(data: Uint8Array, offset: number, bytes: number): [number, number] {
  need(data, offset, bytes);
  let v = 0;
  for (let i = 0; i < bytes; i++) v |= data[offset + i] << (8 * i);
  return [v >>> 0, offset + bytes]; // 保证无符号
}

function readBigintLE(data: Uint8Array, offset: number, bytes: number): [bigint, number] {
  need(data, offset, bytes);
  let v = 0n;
  for (let i = 0; i < bytes; i++) v |= BigInt(data[offset + i]) << BigInt(8 * i);
  return [v, offset + bytes];
}

function toAddressHexShort(addr32: Uint8Array): string {
  // 32 字节 -> 去掉前导 00，至少保留 0
  let hex = bytesToHex(addr32).slice(2).replace(/^0+/, "");
  if (hex.length === 0) hex = "0";
  return "0x" + hex;
}

function toAddressHexLong(addr32: Uint8Array): string {
  return bytesToHex(addr32);
}

function bytesFrom(input: Uint8Array | string): Uint8Array {
  if (input instanceof Uint8Array) return input;
  return hexToBytes(input);
}

/**
 * 从 data[offset] 开始按 tag 读取一个值，返回 [value, newOffset]
 */
export function decodeArg(tag: TypeTag, data: Uint8Array, offset = 0): [any, number] {
  switch (tag.kind) {
    case "bool": {
      need(data, offset, 1);
      const b = data[offset];
      if (b !== 0 && b !== 1) throw new Error(`Invalid bool byte: ${b}`);
      return [b === 1, offset + 1];
    }
    case "u8": {
      need(data, offset, 1);
      return [data[offset], offset + 1];
    }
    case "u16": return readNumberLE(data, offset, 2);
    case "u32": return readNumberLE(data, offset, 4);
    case "u64": return readBigintLE(data, offset, 8);
    case "u128": return readBigintLE(data, offset, 16);
    case "u256": return readBigintLE(data, offset, 32);

    case "address": {
      need(data, offset, 32);
      const slice = data.subarray(offset, offset + 32);
      return [toAddressHexLong(slice), offset + 32];
    }

    case "string": {
      const [len, o1] = readULEB128(data, offset);
      need(data, o1, len);
      const bytes = data.subarray(o1, o1 + len);
      return [td.decode(bytes), o1 + len];
    }

    case "vector": {
      const [len, o1] = readULEB128(data, offset);

      // vector<u8> -> Uint8Array
      if (tag.elem.kind === "u8") {
        need(data, o1, len);
        const bytes = data.subarray(o1, o1 + len);
        return [new Uint8Array(bytes), o1 + len];
      }

      // 一般 vector<T> -> T[]（递归）
      const out: any[] = [];
      let o = o1;
      for (let i = 0; i < len; i++) {
        const [v, o2] = decodeArg(tag.elem, data, o);
        out.push(v);
        o = o2;
      }
      return [out, o];
    }

    case "option": {
      // BCS: vector<T>，0 元素 => None，1 元素 => Some
      const [len, o1] = readULEB128(data, offset);
      if (len === 0) return [null, o1];
      if (len === 1) return decodeArg(tag.elem, data, o1);
      throw new Error(`Invalid Option length: ${len}`);
    }

    case "generic":
      throw new Error("Generic must be substituted before decoding");

    case "struct": {
      const fq = `${tag.address}::${tag.module}::${tag.name}`;

      // 兼容：0x1::string::String 当作 string 编码
      if (tag.address.toLowerCase() === "0x1" && tag.module === "string" && tag.name === "String") {
        const [len, o1] = readULEB128(data, offset);
        need(data, o1, len);
        const bytes = data.subarray(o1, o1 + len);
        return [td.decode(bytes), o1 + len];
      }

      // 兼容：0x1::object::Object<T> 当作对象 ID（address）
      if (tag.address.toLowerCase() === "0x1" && tag.module === "object" && tag.name === "Object") {
        need(data, offset, 32);
        const slice = data.subarray(offset, offset + 32);
        return [toAddressHexLong(slice), offset + 32];
      }

      // 其他 struct —— 需要你根据定义（字段顺序）自行扩展
      throw new Error(`Unsupported struct in decode: ${fq}. Extend 'decodeArg' to handle it.`);
    }
  }
}

/** 对单个参数做完整反解析（必须完全吃光字节） */
export function decodeFromBytes(tag: TypeTag, input: Uint8Array | string): any {
  const bytes = bytesFrom(input);
  const [v, o] = decodeArg(tag, bytes, 0);
  if (o !== bytes.length) {
    throw new Error(`Trailing bytes after decoding: consumed ${o}/${bytes.length}`);
  }
  return v;
}

/**
 * 批量反解析（与 prepareBcsArgs 的输出一一对应）
 * @param paramTypeStrings 参数类型（可含 T0/T1/...）
 * @param bcsArgs 每个参数的 BCS 字节（Uint8Array 或 0x..hex）
 * @param typeArgStrings 类型实参（可空）
 */
export function decodeBcsArgs(opts: {
  paramTypeStrings: string[];
  bcsArgs: (Uint8Array | string)[];
  typeArgStrings?: string[];
}): any[] {
  const { paramTypeStrings, bcsArgs, typeArgStrings = [] } = opts;
  if (paramTypeStrings.length !== bcsArgs.length) {
    throw new Error(`Argument count mismatch: expect ${paramTypeStrings.length}, got ${bcsArgs.length}`);
  }
  const paramTags = paramTypeStrings.map(parseTypeTagLite);
  const typeArgs = typeArgStrings.map(parseTypeTagLite);
  const replaced = paramTags.map(t => substituteGenerics(t, typeArgs));
  return replaced.map((t, i) => decodeFromBytes(t, bcsArgs[i]));
}


export function encodeArgsAptosTypes(
  tag: TypeTag,
  value: unknown
): EntryFunctionArgumentTypes{
  switch (tag.kind) {
    case "bool":
      if (value === "true") return new Bool(true);
      if (value === "false") return new Bool(false);
      if (typeof value === "boolean") return new Bool(value);
      throw new Error("Invalid bool value: " + value);
    case "u8":
      return new U8(Number(value));
    case "u16":
      return new U16(Number(value)); 
    case "address":
      return AccountAddress.fromString(value as string);
    case "string":
      return new MoveString(String(value));
    case "vector":
      return new MoveVector( (value as []).map(item => encodeArgsAptosTypes(tag.elem, item)) );
    case "option":
      return new MoveOption(value === null || value === undefined ? null : value === ""? null : encodeArgsAptosTypes(tag.elem, value));
    case "struct":
      if( AccountAddress.fromString(tag.address).toString() === "0x1" && tag.module === "object" && tag.name === "Object") {
        return AccountAddress.from(value as string);
      }else if (AccountAddress.fromString(tag.address).toString() === "0x1" && tag.module === "string" && tag.name === "String") {
        return new MoveString(String(value));
      }
      throw new Error(`Unsupported struct in encode: ${tag.address}::${tag.module}::${tag.name}`);
  }
  throw new Error(`Unsupported type in encode: ${tag.kind}`);
}

export function encodeArgsPrimitivesTypes(
  tag: TypeTag,
  value: unknown
): SimpleEntryFunctionArgumentTypes{
  switch (tag.kind) {
    case "bool":
      if (value === "true") return true;
      if (value === "false") return false;
      if (typeof value === "boolean") return value;
      throw new Error("Invalid bool value: " + value);
    case "u8":
      return Number(value);
    case "u16":
      return Number(value);
    case "u32":
      return Number(value);
    case "u64":
      return Number(value);
    case "u128":
      return Number(value);
    case "u256":
      return Number(value);
    case "address":
      return AccountAddress.fromString(value as string).toString();
    case "string":
      return String(value);
    case "vector":
      const valueArray = JSON.parse(value as string) as unknown[];
      return valueArray.map(item => encodeArgsPrimitivesTypes(tag.elem, item));
    case "option":
      return value === null || value === undefined ? null : value === ""? null : encodeArgsPrimitivesTypes(tag.elem, value);
  }
}