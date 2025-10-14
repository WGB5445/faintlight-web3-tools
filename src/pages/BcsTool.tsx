import { useMemo, useState } from 'react';
import {
  bytesToHex,
  decodePrimitive,
  encodePrimitive,
  hexToBytes,
  PrimitiveBcsType
} from '../lib/bcs';

type EncodeInputMode = 'text' | 'hex';

const PRIMITIVE_OPTIONS: Array<{ value: PrimitiveBcsType; label: string; hint: string }> = [
  { value: 'bool', label: 'bool', hint: '单字节 0 / 1' },
  { value: 'u8', label: 'u8', hint: '0-255 的整数' },
  { value: 'u16', label: 'u16', hint: '16 位无符号整数' },
  { value: 'u32', label: 'u32', hint: '32 位无符号整数' },
  { value: 'u64', label: 'u64', hint: '64 位无符号整数 (建议使用字符串)' },
  { value: 'u128', label: 'u128', hint: '128 位无符号整数 (使用字符串)' },
  { value: 'u256', label: 'u256', hint: '256 位无符号整数 (使用字符串)' },
  { value: 'address', label: 'address', hint: '32 字节账户地址' },
  { value: 'string', label: 'string', hint: 'UTF-8 字符串 (自动做长度前缀)' },
  { value: 'vector<u8>', label: 'vector<u8>', hint: '任意字节数组' }
];

export default function BcsToolPage() {
  const [mode, setMode] = useState<'encode' | 'decode'>('encode');
  const [primitive, setPrimitive] = useState<PrimitiveBcsType>('string');
  const [textInput, setTextInput] = useState('');
  const [hexInput, setHexInput] = useState('');
  const [boolInput, setBoolInput] = useState(true);
  const [vectorMode, setVectorMode] = useState<EncodeInputMode>('text');
  const [result, setResult] = useState<string>('');
  const [auxiliary, setAuxiliary] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const currentHint = useMemo(() => PRIMITIVE_OPTIONS.find((item) => item.value === primitive)?.hint ?? '', [primitive]);

  const resetOutputs = () => {
    setResult('');
    setAuxiliary('');
    setError(null);
  };

  const handleRun = () => {
    resetOutputs();
    try {
      if (mode === 'encode') {
        let value: unknown;
        switch (primitive) {
          case 'bool':
            value = boolInput;
            break;
          case 'string':
            value = textInput;
            break;
          case 'address':
            if (!textInput.trim()) throw new Error('地址不能为空');
            value = textInput.trim();
            break;
          case 'vector<u8>':
            if (vectorMode === 'text') {
              value = new TextEncoder().encode(textInput);
            } else {
              value = hexToBytes(hexInput.trim());
            }
            break;
          default:
            if (!textInput.trim()) throw new Error('请输入数值');
            value = textInput.trim();
            break;
        }

        const encoded = encodePrimitive(primitive, value as any);
        setResult(bytesToHex(encoded));
        setAuxiliary(`字节长度：${encoded.length}B`);
      } else {
        if (!hexInput.trim()) throw new Error('请输入 BCS Hex');
        const decodedBytes = hexToBytes(hexInput.trim());
        const decoded = decodePrimitive(primitive, decodedBytes);
        switch (primitive) {
          case 'bool':
            setResult(decoded ? 'true' : 'false');
            break;
          case 'string':
            setResult(String(decoded));
            setAuxiliary(`原始字节：${bytesToHex(new TextEncoder().encode(String(decoded)))}`);
            break;
          case 'vector<u8>': {
            const hex = decoded as string;
            const text = new TextDecoder().decode(hexToBytes(hex));
            setResult(`Hex: ${hex}`);
            setAuxiliary(`作为文本尝试解析：${text}`);
            break;
          }
          case 'address':
            setResult(String(decoded));
            break;
          default:
            setResult(decoded.toString());
            break;
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const renderEncodeInput = () => {
    switch (primitive) {
      case 'bool':
        return (
          <label className="flex items-center gap-3 text-sm text-slate-200">
            <span>布尔值</span>
            <input type="checkbox" checked={boolInput} onChange={(event) => setBoolInput(event.target.checked)} />
            <span className="text-xs text-slate-400">勾选代表 true</span>
          </label>
        );
      case 'vector<u8>':
        return (
          <div className="space-y-3">
            <div className="flex gap-2 text-xs">
              <button
                type="button"
                onClick={() => setVectorMode('text')}
                className={`rounded-full px-3 py-1 ${
                  vectorMode === 'text' ? 'bg-sky-500/30 text-sky-200' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                文本输入
              </button>
              <button
                type="button"
                onClick={() => setVectorMode('hex')}
                className={`rounded-full px-3 py-1 ${
                  vectorMode === 'hex' ? 'bg-sky-500/30 text-sky-200' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                Hex 输入
              </button>
            </div>
            {vectorMode === 'text' ? (
              <textarea
                className="min-h-[100px] w-full rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm text-slate-100"
                placeholder="任意字符串，将按 UTF-8 编码为字节"
                value={textInput}
                onChange={(event) => setTextInput(event.target.value)}
              />
            ) : (
              <textarea
                className="min-h-[100px] w-full rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm text-slate-100"
                placeholder="0x..."
                value={hexInput}
                onChange={(event) => setHexInput(event.target.value)}
              />
            )}
          </div>
        );
      case 'string':
        return (
          <textarea
            className="min-h-[100px] w-full rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm text-slate-100"
            placeholder="UTF-8 字符串"
            value={textInput}
            onChange={(event) => setTextInput(event.target.value)}
          />
        );
      default:
        return (
          <input
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
            placeholder="输入原始值"
            value={textInput}
            onChange={(event) => setTextInput(event.target.value)}
          />
        );
    }
  };

  const renderDecodeInput = () => (
    <textarea
      className="min-h-[120px] w-full rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm text-slate-100"
      placeholder="BCS Hex，例如 0x0a00"
      value={hexInput}
      onChange={(event) => setHexInput(event.target.value)}
    />
  );

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">BCS 编码 / 解码</h1>
        <p className="text-slate-300">支持常见原语、地址与字节向量的编码/解码，方便与 Aptos 合约交互时调试参数。</p>
      </header>

      <section className="space-y-6">
        <div className="flex flex-wrap gap-3 text-xs">
          <button
            type="button"
            onClick={() => {
              setMode('encode');
              resetOutputs();
            }}
            className={`rounded-full px-3 py-1 transition ${
              mode === 'encode' ? 'bg-sky-500/30 text-sky-200' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            BCS 编码
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('decode');
              resetOutputs();
            }}
            className={`rounded-full px-3 py-1 transition ${
              mode === 'decode' ? 'bg-sky-500/30 text-sky-200' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            BCS 解码
          </button>
        </div>

        <div className="space-y-3">
          <label className="flex flex-col gap-2 text-sm font-medium text-slate-200">
            选择类型
            <select
              className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100"
              value={primitive}
              onChange={(event) => {
                setPrimitive(event.target.value as PrimitiveBcsType);
                resetOutputs();
              }}
            >
              {PRIMITIVE_OPTIONS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <p className="text-xs text-slate-500">{currentHint}</p>
        </div>

        <div>{mode === 'encode' ? renderEncodeInput() : renderDecodeInput()}</div>

        <button
          type="button"
          onClick={handleRun}
          className="w-full rounded-lg bg-sky-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-sky-400"
        >
          {mode === 'encode' ? '编码为 BCS Hex' : '解码 BCS Hex'}
        </button>

        {error ? <p className="text-sm text-rose-400">{error}</p> : null}

        {result && (
          <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-900/60 p-5 text-sm text-slate-200">
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">结果</p>
              <p className="mt-1 break-all font-mono text-xs text-sky-300">{result}</p>
            </div>
            {auxiliary && (
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">附加信息</p>
                <p className="mt-1 break-all text-xs text-slate-300">{auxiliary}</p>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
