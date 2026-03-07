import { useMemo, useState } from "react";
import { useLanguage } from "../context/LanguageContext";
import {
  AccountAddress,
  Bool,
  Deserializer,
  Hex,
  MoveOption,
  MoveString,
  MoveVector,
  U8,
  U16,
  U32,
  U64,
  U128,
  U256,
  type AnyNumber,
  type EntryFunctionArgument,
  type Serializable,
} from "@aptos-labs/ts-sdk";
import { Buffer } from "buffer";

type EncodeInputMode = "text" | "hex";
type BasePrimitive =
  | "bool"
  | "u8"
  | "u16"
  | "u32"
  | "u64"
  | "u128"
  | "u256"
  | "address"
  | "string"
  | "vector<u8>";
type WrapperType = "vector" | "option";
type PrimitiveName = Exclude<BasePrimitive, "vector<u8>">;
type BcsSerializable = Serializable & EntryFunctionArgument;

type TypeNode =
  | { kind: "primitive"; name: PrimitiveName }
  | { kind: "vector"; inner: TypeNode }
  | { kind: "option"; inner: TypeNode };

const BASE_TYPE_OPTIONS: Array<{
  value: BasePrimitive;
  labelKey: string;
  hintKey: string;
}> = [
  {
    value: "bool",
    labelKey: "bcs.options.bool.label",
    hintKey: "bcs.options.bool.hint",
  },
  {
    value: "u8",
    labelKey: "bcs.options.u8.label",
    hintKey: "bcs.options.u8.hint",
  },
  {
    value: "u16",
    labelKey: "bcs.options.u16.label",
    hintKey: "bcs.options.u16.hint",
  },
  {
    value: "u32",
    labelKey: "bcs.options.u32.label",
    hintKey: "bcs.options.u32.hint",
  },
  {
    value: "u64",
    labelKey: "bcs.options.u64.label",
    hintKey: "bcs.options.u64.hint",
  },
  {
    value: "u128",
    labelKey: "bcs.options.u128.label",
    hintKey: "bcs.options.u128.hint",
  },
  {
    value: "u256",
    labelKey: "bcs.options.u256.label",
    hintKey: "bcs.options.u256.hint",
  },
  {
    value: "address",
    labelKey: "bcs.options.address.label",
    hintKey: "bcs.options.address.hint",
  },
  {
    value: "string",
    labelKey: "bcs.options.string.label",
    hintKey: "bcs.options.string.hint",
  },
  {
    value: "vector<u8>",
    labelKey: "bcs.options.vectorU8.label",
    hintKey: "bcs.options.vectorU8.hint",
  },
];

const WRAPPER_LIMIT = 4;

function buildBaseNode(base: BasePrimitive): TypeNode {
  if (base === "vector<u8>") {
    return { kind: "vector", inner: { kind: "primitive", name: "u8" } };
  }
  return { kind: "primitive", name: base };
}

function buildTypeNode(base: BasePrimitive, wrappers: WrapperType[]): TypeNode {
  return wrappers.reduce<TypeNode>(
    (acc, wrapper) =>
      wrapper === "vector"
        ? { kind: "vector", inner: acc }
        : { kind: "option", inner: acc },
    buildBaseNode(base),
  );
}

function describeType(node: TypeNode): string {
  switch (node.kind) {
    case "primitive":
      return node.name;
    case "vector":
      return `vector<${describeType(node.inner)}>`;
    case "option":
      return `option<${describeType(node.inner)}>`;
    default:
      return "unknown";
  }
}

function isNumericNode(node: TypeNode): boolean {
  return (
    node.kind === "primitive" &&
    ["u8", "u16", "u32", "u64", "u128", "u256"].includes(node.name)
  );
}

function isVectorU8Node(node: TypeNode): boolean {
  return (
    node.kind === "vector" &&
    node.inner.kind === "primitive" &&
    node.inner.name === "u8"
  );
}

function formatJsonValue(value: unknown) {
  if (typeof value === "string") {
    return JSON.stringify(value);
  }
  return JSON.stringify(value, null, 2);
}

export default function BcsToolPage() {
  const { t } = useLanguage();
  const [mode, setMode] = useState<"encode" | "decode">("encode");
  const [baseType, setBaseType] = useState<BasePrimitive>("string");
  const [wrappers, setWrappers] = useState<WrapperType[]>([]);
  const [textInput, setTextInput] = useState("");
  const [hexInput, setHexInput] = useState("");
  const [boolInput, setBoolInput] = useState(true);
  const [vectorMode, setVectorMode] = useState<EncodeInputMode>("text");
  const [result, setResult] = useState("");
  const [auxiliary, setAuxiliary] = useState("");
  const [error, setError] = useState<string | null>(null);

  const typeNode = useMemo(
    () => buildTypeNode(baseType, wrappers),
    [baseType, wrappers],
  );
  const readableType = useMemo(() => describeType(typeNode), [typeNode]);

  const baseHint = useMemo(() => {
    const option = BASE_TYPE_OPTIONS.find((item) => item.value === baseType);
    return option ? t(option.hintKey) : "";
  }, [baseType, t]);

  const requiresStructuredInput = useMemo(() => {
    if (typeNode.kind === "primitive") {
      return false;
    }
    if (isVectorU8Node(typeNode)) {
      return false;
    }
    return true;
  }, [typeNode]);

  const currentHint = useMemo(() => {
    const parts = [baseHint];
    if (wrappers.length > 0) {
      parts.push(t("bcs.typeSelect.wrapperHint"));
    }
    if (requiresStructuredInput) {
      parts.push(t("bcs.encode.jsonHint"));
    }
    return parts.filter(Boolean).join(" ");
  }, [baseHint, requiresStructuredInput, t, wrappers.length]);

  const resetOutputs = () => {
    setResult("");
    setAuxiliary("");
    setError(null);
  };

  const resetInputsForTypeChange = () => {
    setTextInput("");
    setHexInput("");
    setBoolInput(true);
    setVectorMode("text");
  };

  const parseStructuredInput = () => {
    const trimmed = textInput.trim();
    if (!trimmed) {
      throw new Error(t("bcs.errors.jsonRequired"));
    }
    try {
      return JSON.parse(trimmed);
    } catch (parseError) {
      throw new Error(t("bcs.errors.invalidJson"));
    }
  };

  const normalizeSmallNumeric = (raw: unknown, typeLabel: string) => {
    if (typeof raw === "number" && Number.isFinite(raw)) {
      return raw;
    }
    if (typeof raw === "string") {
      const trimmed = raw.trim();
      if (!trimmed) {
        throw new Error(t("bcs.errors.valueRequired"));
      }
      const parsed = Number(trimmed);
      if (Number.isNaN(parsed)) {
        throw new Error(t("bcs.errors.invalidNumber", { type: typeLabel }));
      }
      return parsed;
    }
    if (typeof raw === "bigint") {
      return Number(raw);
    }
    throw new Error(t("bcs.errors.invalidNumber", { type: typeLabel }));
  };

  const normalizeBigNumeric = (raw: unknown, typeLabel: string): AnyNumber => {
    if (typeof raw === "bigint") {
      return raw;
    }
    if (typeof raw === "number" && Number.isFinite(raw)) {
      if (!Number.isInteger(raw)) {
        throw new Error(t("bcs.errors.invalidNumber", { type: typeLabel }));
      }
      return Math.trunc(raw);
    }
    if (typeof raw === "string") {
      const trimmed = raw.trim();
      if (!trimmed) {
        throw new Error(t("bcs.errors.valueRequired"));
      }
      try {
        return BigInt(trimmed);
      } catch (parseError) {
        throw new Error(t("bcs.errors.invalidNumber", { type: typeLabel }));
      }
    }
    throw new Error(t("bcs.errors.invalidNumber", { type: typeLabel }));
  };

  const buildArgumentFromValue = (
    node: TypeNode,
    value: unknown,
  ): BcsSerializable => {
    if (node.kind === "primitive") {
      const typeLabel = describeType(node);
      switch (node.name) {
        case "bool":
          if (typeof value !== "boolean") {
            throw new Error(t("bcs.errors.invalidBoolean"));
          }
          return new Bool(value);
        case "u8":
          return new U8(normalizeSmallNumeric(value, typeLabel));
        case "u16":
          return new U16(normalizeSmallNumeric(value, typeLabel));
        case "u32":
          return new U32(normalizeSmallNumeric(value, typeLabel));
        case "u64":
          return new U64(normalizeBigNumeric(value, typeLabel));
        case "u128":
          return new U128(normalizeBigNumeric(value, typeLabel));
        case "u256":
          return new U256(normalizeBigNumeric(value, typeLabel));
        case "address": {
          if (typeof value !== "string") {
            throw new Error(t("bcs.errors.valueRequired"));
          }
          return AccountAddress.fromString(value.trim());
        }
        case "string":
          return new MoveString(String(value));
        default:
          throw new Error(t("bcs.errors.unsupportedType", { type: typeLabel }));
      }
    }

    if (node.kind === "vector") {
      if (isVectorU8Node(node)) {
        if (typeof value === "string") {
          const trimmed = value.trim();
          if (!trimmed) {
            return MoveVector.U8([]);
          }
          if (trimmed.startsWith("0x") || trimmed.startsWith("0X")) {
            return MoveVector.U8(Hex.fromHexInput(trimmed).toUint8Array());
          }
          return MoveVector.U8(new TextEncoder().encode(trimmed));
        }
        if (value instanceof Uint8Array) {
          return MoveVector.U8(value);
        }
        if (Array.isArray(value)) {
          const numbers = value.map((item) => {
            if (typeof item === "number" && Number.isFinite(item)) {
              return item;
            }
            if (typeof item === "string") {
              const parsed = Number(item);
              if (Number.isNaN(parsed)) {
                throw new Error(t("bcs.errors.vectorU8Array"));
              }
              return parsed;
            }
            if (typeof item === "bigint") {
              return Number(item);
            }
            throw new Error(t("bcs.errors.vectorU8Array"));
          });
          return MoveVector.U8(numbers);
        }
        throw new Error(t("bcs.errors.vectorBytesInput"));
      }

      if (!Array.isArray(value)) {
        throw new Error(
          t("bcs.errors.vectorRequiresArray", { type: describeType(node) }),
        );
      }
      const items = value.map((item) =>
        buildArgumentFromValue(node.inner, item),
      ) as BcsSerializable[];
      return new MoveVector(items);
    }

    // option
    if (value === null || typeof value === "undefined") {
      return new MoveOption();
    }
    return new MoveOption(buildArgumentFromValue(node.inner, value));
  };

  const decodeValue = (node: TypeNode, deserializer: Deserializer): unknown => {
    if (node.kind === "primitive") {
      switch (node.name) {
        case "bool":
          return deserializer.deserializeBool();
        case "u8":
          return deserializer.deserializeU8();
        case "u16":
          return deserializer.deserializeU16();
        case "u32":
          return deserializer.deserializeU32();
        case "u64":
          return deserializer.deserializeU64().toString();
        case "u128":
          return deserializer.deserializeU128().toString();
        case "u256":
          return deserializer.deserializeU256().toString();
        case "string":
          return deserializer.deserializeStr();
        case "address":
          return AccountAddress.deserialize(deserializer).toString();
        default:
          throw new Error(
            t("bcs.errors.unsupportedType", { type: describeType(node) }),
          );
      }
    }

    if (node.kind === "vector") {
      if (isVectorU8Node(node)) {
        return deserializer.deserializeBytes();
      }
      const length = deserializer.deserializeUleb128AsU32();
      const values: unknown[] = [];
      for (let i = 0; i < length; i += 1) {
        values.push(decodeValue(node.inner, deserializer));
      }
      return values;
    }

    const length = deserializer.deserializeUleb128AsU32();
    if (length === 0) {
      return null;
    }
    if (length !== 1) {
      throw new Error(t("bcs.errors.invalidOptionLength"));
    }
    return decodeValue(node.inner, deserializer);
  };

  const collectInputValue = () => {
    if (typeNode.kind === "primitive") {
      switch (typeNode.name) {
        case "bool":
          return boolInput;
        case "string":
          if (!textInput) {
            throw new Error(t("bcs.errors.valueRequired"));
          }
          return textInput;
        case "address":
          if (!textInput.trim()) {
            throw new Error(t("bcs.errors.valueRequired"));
          }
          return textInput.trim();
        default:
          if (!textInput.trim()) {
            throw new Error(t("bcs.errors.valueRequired"));
          }
          return textInput.trim();
      }
    }

    if (isVectorU8Node(typeNode)) {
      if (vectorMode === "hex") {
        if (!hexInput.trim()) {
          throw new Error(t("bcs.errors.hexRequired"));
        }
        return hexInput.trim();
      }
      return textInput;
    }

    return parseStructuredInput();
  };

  const handleRun = () => {
    resetOutputs();
    try {
      if (mode === "encode") {
        const rawValue = collectInputValue();
        const argument = buildArgumentFromValue(typeNode, rawValue);
        const bytes = argument.bcsToBytes();
        setResult(Hex.fromHexInput(bytes).toString());
        setAuxiliary(t("bcs.encode.byteLength", { length: bytes.length }));
        return;
      }

      if (!hexInput.trim()) {
        throw new Error(t("bcs.errors.hexRequired"));
      }

      const decodedBytes = Hex.hexInputToUint8Array(hexInput.trim());
      const deserializer = new Deserializer(decodedBytes);
      const decoded = decodeValue(typeNode, deserializer);
      deserializer.assertFinished();

      if (typeNode.kind === "primitive") {
        switch (typeNode.name) {
          case "bool":
            setResult(decoded ? "true" : "false");
            return;
          case "string": {
            const text = String(decoded);
            setResult(text);
            setAuxiliary(
              t("bcs.results.rawBytes", {
                bytes: Buffer.from(text, "utf8").toString("hex"),
              }),
            );
            return;
          }
          case "address":
            setResult(String(decoded));
            return;
          default:
            if (isNumericNode(typeNode)) {
              setResult(String(decoded));
              return;
            }
        }
      }

      if (isVectorU8Node(typeNode)) {
        const byteArray = decoded as Uint8Array;
        const hexValue = Buffer.from(byteArray).toString("hex");
        setResult(t("bcs.results.vectorHex", { hex: hexValue }));
        setAuxiliary(
          t("bcs.results.vectorText", {
            text: Buffer.from(byteArray).toString("utf8"),
          }),
        );
        return;
      }

      if (typeNode.kind === "option") {
        if (decoded === null) {
          setResult(t("bcs.results.optionNone"));
        } else {
          setResult(
            t("bcs.results.optionSome", { value: formatJsonValue(decoded) }),
          );
        }
        return;
      }

      setResult(formatJsonValue(decoded));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const renderEncodeInput = () => {
    if (typeNode.kind === "primitive" && typeNode.name === "bool") {
      return (
        <label className="flex items-center gap-3 text-sm text-slate-200">
          <span>{t("bcs.encode.boolLabel")}</span>
          <input
            type="checkbox"
            checked={boolInput}
            onChange={(event) => setBoolInput(event.target.checked)}
            className="h-4 w-4 rounded border-slate-700 bg-slate-900"
          />
          <span className="text-xs text-slate-500">
            {t("bcs.encode.boolHint")}
          </span>
        </label>
      );
    }

    if (isVectorU8Node(typeNode)) {
      return (
        <div className="space-y-3">
          <div className="flex gap-2 text-xs">
            <button
              type="button"
              onClick={() => setVectorMode("text")}
              className={`rounded-lg border px-3 py-2 font-medium transition ${
                vectorMode === "text"
                  ? "border-sky-500 bg-sky-500/20 text-sky-100 shadow-sm shadow-sky-500/20"
                  : "border-slate-700 bg-slate-900/60 text-slate-300 hover:border-slate-600 hover:text-sky-200"
              }`}
            >
              {t("bcs.encode.vectorModeText")}
            </button>
            <button
              type="button"
              onClick={() => setVectorMode("hex")}
              className={`rounded-lg border px-3 py-2 font-medium transition ${
                vectorMode === "hex"
                  ? "border-sky-500 bg-sky-500/20 text-sky-100 shadow-sm shadow-sky-500/20"
                  : "border-slate-700 bg-slate-900/60 text-slate-300 hover:border-slate-600 hover:text-sky-200"
              }`}
            >
              {t("bcs.encode.vectorModeHex")}
            </button>
          </div>
          {vectorMode === "text" ? (
            <textarea
              className="min-h-[100px] w-full rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm text-slate-100"
              placeholder={t("bcs.encode.vectorTextPlaceholder")}
              value={textInput}
              onChange={(event) => setTextInput(event.target.value)}
            />
          ) : (
            <textarea
              className="min-h-[100px] w-full rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm text-slate-100"
              placeholder={t("bcs.encode.vectorHexPlaceholder")}
              value={hexInput}
              onChange={(event) => setHexInput(event.target.value)}
            />
          )}
        </div>
      );
    }

    if (typeNode.kind === "primitive" && typeNode.name === "string") {
      return (
        <textarea
          className="min-h-[100px] w-full rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm text-slate-100"
          placeholder={t("bcs.encode.textPlaceholder")}
          value={textInput}
          onChange={(event) => setTextInput(event.target.value)}
        />
      );
    }

    if (
      typeNode.kind === "primitive" &&
      (typeNode.name === "address" || isNumericNode(typeNode))
    ) {
      return (
        <input
          className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
          placeholder={t("bcs.encode.numberPlaceholder")}
          value={textInput}
          onChange={(event) => setTextInput(event.target.value)}
        />
      );
    }

    return (
      <textarea
        className="min-h-[120px] w-full rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm text-slate-100"
        placeholder={t("bcs.encode.jsonPlaceholder")}
        value={textInput}
        onChange={(event) => setTextInput(event.target.value)}
      />
    );
  };

  const renderDecodeInput = () => (
    <textarea
      className="min-h-[120px] w-full rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm text-slate-100"
      placeholder={t("bcs.decode.hexPlaceholder")}
      value={hexInput}
      onChange={(event) => setHexInput(event.target.value)}
    />
  );

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">
          {t("bcs.title")}
        </h1>
        <p className="text-slate-300">{t("bcs.description")}</p>
      </header>

      <section className="space-y-6">
        <div className="flex flex-wrap gap-3 text-sm">
          <button
            type="button"
            onClick={() => {
              setMode("encode");
              resetOutputs();
            }}
            className={`rounded-lg border px-4 py-2 font-medium transition ${
              mode === "encode"
                ? "border-sky-500 bg-sky-500/20 text-sky-100 shadow-sm shadow-sky-500/20"
                : "border-slate-700 bg-slate-900/60 text-slate-300 hover:border-slate-600 hover:text-sky-200"
            }`}
          >
            {t("bcs.mode.encode")}
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("decode");
              resetOutputs();
            }}
            className={`rounded-lg border px-4 py-2 font-medium transition ${
              mode === "decode"
                ? "border-sky-500 bg-sky-500/20 text-sky-100 shadow-sm shadow-sky-500/20"
                : "border-slate-700 bg-slate-900/60 text-slate-300 hover:border-slate-600 hover:text-sky-200"
            }`}
          >
            {t("bcs.mode.decode")}
          </button>
        </div>

        <div className="space-y-3">
          <label className="flex flex-col gap-2 text-sm font-medium text-slate-200">
            {t("bcs.typeSelect.label")}
            <select
              className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100"
              value={baseType}
              onChange={(event) => {
                setBaseType(event.target.value as BasePrimitive);
                resetOutputs();
                resetInputsForTypeChange();
              }}
            >
              {BASE_TYPE_OPTIONS.map((item) => (
                <option key={item.value} value={item.value}>
                  {t(item.labelKey)}
                </option>
              ))}
            </select>
          </label>

          <div className="space-y-2">
            <span className="text-sm font-medium text-slate-200">
              {t("bcs.typeSelect.wrapperLabel")}
            </span>
            <div className="flex flex-wrap gap-2 text-xs">
              <button
                type="button"
                onClick={() => {
                  if (wrappers.length >= WRAPPER_LIMIT) return;
                  setWrappers((prev) => [...prev, "vector"]);
                  resetOutputs();
                  resetInputsForTypeChange();
                }}
                className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1 font-medium text-slate-300 transition hover:border-slate-600 hover:text-sky-200"
              >
                {t("bcs.typeSelect.addVector")}
              </button>
              <button
                type="button"
                onClick={() => {
                  if (wrappers.length >= WRAPPER_LIMIT) return;
                  setWrappers((prev) => [...prev, "option"]);
                  resetOutputs();
                  resetInputsForTypeChange();
                }}
                className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1 font-medium text-slate-300 transition hover:border-slate-600 hover:text-sky-200"
              >
                {t("bcs.typeSelect.addOption")}
              </button>
              {wrappers.length > 0 ? (
                <button
                  type="button"
                  onClick={() => {
                    setWrappers([]);
                    resetOutputs();
                    resetInputsForTypeChange();
                  }}
                  className="rounded-full border border-rose-700/60 bg-rose-900/40 px-3 py-1 font-medium text-rose-200 transition hover:border-rose-600 hover:bg-rose-900/50"
                >
                  {t("bcs.typeSelect.clearWrappers")}
                </button>
              ) : null}
            </div>
            {wrappers.length === 0 ? (
              <p className="text-xs text-slate-500">
                {t("bcs.typeSelect.wrapperEmpty")}
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {wrappers.map((wrapper, index) => (
                  <button
                    key={`${wrapper}-${index}`}
                    type="button"
                    onClick={() => {
                      setWrappers((prev) =>
                        prev.filter((_, idx) => idx !== index),
                      );
                      resetOutputs();
                      resetInputsForTypeChange();
                    }}
                    aria-label={t("bcs.typeSelect.removeWrapper", {
                      wrapper: t(`bcs.typeSelect.wrapperNames.${wrapper}`),
                    })}
                    className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-xs text-slate-200 transition hover:border-slate-600 hover:text-sky-200"
                  >
                    <span>{t(`bcs.typeSelect.wrapperNames.${wrapper}`)}</span>
                    <span aria-hidden className="text-slate-500">
                      ×
                    </span>
                  </button>
                ))}
              </div>
            )}
            <p className="text-xs text-slate-500">
              {t("bcs.typeSelect.currentType", { type: readableType })}
            </p>
          </div>

          <p className="text-xs text-slate-500">{currentHint}</p>
        </div>

        <div>
          {mode === "encode" ? renderEncodeInput() : renderDecodeInput()}
        </div>

        <button
          type="button"
          onClick={handleRun}
          className="w-full rounded-lg bg-sky-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-sky-400"
        >
          {mode === "encode"
            ? t("bcs.actions.runEncode")
            : t("bcs.actions.runDecode")}
        </button>

        {error ? <p className="text-sm text-rose-400">{error}</p> : null}

        {result ? (
          <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-900/60 p-5 text-sm text-slate-200">
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">
                {t("bcs.results.title")}
              </p>
              <pre className="mt-1 whitespace-pre-wrap break-words font-mono text-xs text-sky-300">
                {result}
              </pre>
            </div>
            {auxiliary ? (
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">
                  {t("bcs.results.extraTitle")}
                </p>
                <pre className="mt-1 whitespace-pre-wrap break-words text-xs text-slate-300">
                  {auxiliary}
                </pre>
              </div>
            ) : null}
          </div>
        ) : null}
      </section>
    </div>
  );
}
