import { useMemo, useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { EntryFunctionArgumentTypes, SimpleEntryFunctionArgumentTypes , Bool, MoveString, AccountAddress, Hex, MoveVector, U8, Deserializer} from '@aptos-labs/ts-sdk';
import { Buffer } from 'buffer';

type EncodeInputMode = 'text' | 'hex';

const PRIMITIVE_OPTIONS: Array<{ value: SimpleEntryFunctionArgumentTypes; labelKey: string; hintKey: string }> = [
  { value: 'bool', labelKey: 'bcs.options.bool.label', hintKey: 'bcs.options.bool.hint' },
  { value: 'u8', labelKey: 'bcs.options.u8.label', hintKey: 'bcs.options.u8.hint' },
  { value: 'u16', labelKey: 'bcs.options.u16.label', hintKey: 'bcs.options.u16.hint' },
  { value: 'u32', labelKey: 'bcs.options.u32.label', hintKey: 'bcs.options.u32.hint' },
  { value: 'u64', labelKey: 'bcs.options.u64.label', hintKey: 'bcs.options.u64.hint' },
  { value: 'u128', labelKey: 'bcs.options.u128.label', hintKey: 'bcs.options.u128.hint' },
  { value: 'u256', labelKey: 'bcs.options.u256.label', hintKey: 'bcs.options.u256.hint' },
  { value: 'address', labelKey: 'bcs.options.address.label', hintKey: 'bcs.options.address.hint' },
  { value: 'string', labelKey: 'bcs.options.string.label', hintKey: 'bcs.options.string.hint' },
  { value: 'vector<u8>', labelKey: 'bcs.options.vectorU8.label', hintKey: 'bcs.options.vectorU8.hint' }
];

export default function BcsToolPage() {
  const { t } = useLanguage();
  const [mode, setMode] = useState<'encode' | 'decode'>('encode');
  const [primitive, setPrimitive] = useState<SimpleEntryFunctionArgumentTypes>('string');
  const [textInput, setTextInput] = useState('');
  const [hexInput, setHexInput] = useState('');
  const [boolInput, setBoolInput] = useState(true);
  const [vectorMode, setVectorMode] = useState<EncodeInputMode>('text');
  const [result, setResult] = useState<string>('');
  const [auxiliary, setAuxiliary] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const currentHint = useMemo(() => {
    const option = PRIMITIVE_OPTIONS.find((item) => item.value === primitive);
    return option ? t(option.hintKey) : '';
  }, [primitive, t]);

  const resetOutputs = () => {
    setResult('');
    setAuxiliary('');
    setError(null);
  };

  const handleRun = () => {
    resetOutputs();
    try {
      if (mode === 'encode') {
        let value: string;
        switch (primitive) {
          case 'bool':
            value = new Bool(boolInput).bcsToHex().toString();
            break;
          case 'string':
            value = new MoveString(textInput).bcsToHex().toString();
            break;
          case 'address':
            if (!textInput.trim()) throw new Error(t('bcs.errors.valueRequired'));
            value = AccountAddress.fromString(textInput.trim()).bcsToHex().toString();
            break;
          case 'vector<u8>':
            if (vectorMode === 'text') {
              value = MoveVector.U8(new TextEncoder().encode(textInput)).bcsToHex().toString();
            } else {
              if (!hexInput.trim()) throw new Error(t('bcs.errors.hexRequired'));
              value = MoveVector.U8(Hex.fromHexInput(hexInput.trim()).toUint8Array()).bcsToHex().toString();
            }
            break;
          default:
            if (!textInput.trim()) throw new Error(t('bcs.errors.valueRequired'));
            value = textInput.trim();
            break;
        }

        setResult(value);
        setAuxiliary(t('bcs.encode.byteLength', { length: value.length - 2}));
      } else {
        if (!hexInput.trim()) throw new Error(t('bcs.errors.hexRequired'));
        const decodedBytes = Hex.fromHexInput(hexInput.trim()).toUint8Array();
        const decoded = new Deserializer(decodedBytes);
        switch (primitive) {
          case 'bool':
            setResult(decoded.deserialize(Bool) ? 'true' : 'false');
            break;
          case 'string':
            const moveString = decoded.deserialize(MoveString);
            setResult(moveString.value);
            setAuxiliary(t('bcs.results.rawBytes', { bytes: Buffer.from(moveString.value, "utf8").toString("hex") }));
            break;
          case 'vector<u8>': {
            const moveVector = decoded.deserializeVector(U8).map((item) => item.value);
            const hex = Buffer.from(moveVector).toString("hex");
            setResult(t('bcs.results.vectorHex', { hex }));
            setAuxiliary(t('bcs.results.vectorText', { text: Buffer.from(moveVector).toString("utf8") }));
            break;
          }
          case 'address':
            const moveAddress = decoded.deserialize(AccountAddress);
            setResult(moveAddress.toString());
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
            <span>{t('bcs.encode.boolLabel')}</span>
            <input type="checkbox" checked={boolInput} onChange={(event) => setBoolInput(event.target.checked)} />
            <span className="text-xs text-slate-400">{t('bcs.encode.boolHint')}</span>
          </label>
        );
      case 'vector<u8>':
        return (
          <div className="space-y-3">
            <div className="flex gap-2 text-sm">
              <button
                type="button"
                onClick={() => setVectorMode('text')}
                className={`rounded-lg border px-3 py-2 font-medium transition ${
                  vectorMode === 'text'
                    ? 'border-sky-500 bg-sky-500/20 text-sky-100 shadow-sm shadow-sky-500/20'
                    : 'border-slate-700 bg-slate-900/60 text-slate-300 hover:border-slate-600 hover:text-sky-200'
                }`}
              >
                {t('bcs.encode.vectorModeText')}
              </button>
              <button
                type="button"
                onClick={() => setVectorMode('hex')}
                className={`rounded-lg border px-3 py-2 font-medium transition ${
                  vectorMode === 'hex'
                    ? 'border-sky-500 bg-sky-500/20 text-sky-100 shadow-sm shadow-sky-500/20'
                    : 'border-slate-700 bg-slate-900/60 text-slate-300 hover:border-slate-600 hover:text-sky-200'
                }`}
              >
                {t('bcs.encode.vectorModeHex')}
              </button>
            </div>
            {vectorMode === 'text' ? (
              <textarea
                className="min-h-[100px] w-full rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm text-slate-100"
                placeholder={t('bcs.encode.vectorTextPlaceholder')}
                value={textInput}
                onChange={(event) => setTextInput(event.target.value)}
              />
            ) : (
              <textarea
                className="min-h-[100px] w-full rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm text-slate-100"
                placeholder={t('bcs.encode.vectorHexPlaceholder')}
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
            placeholder={t('bcs.encode.textPlaceholder')}
            value={textInput}
            onChange={(event) => setTextInput(event.target.value)}
          />
        );
      default:
        return (
          <input
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
            placeholder={t('bcs.encode.numberPlaceholder')}
            value={textInput}
            onChange={(event) => setTextInput(event.target.value)}
          />
        );
    }
  };

  const renderDecodeInput = () => (
    <textarea
      className="min-h-[120px] w-full rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm text-slate-100"
      placeholder={t('bcs.decode.hexPlaceholder')}
      value={hexInput}
      onChange={(event) => setHexInput(event.target.value)}
    />
  );

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">{t('bcs.title')}</h1>
        <p className="text-slate-300">{t('bcs.description')}</p>
      </header>

      <section className="space-y-6">
        <div className="flex flex-wrap gap-3 text-sm">
          <button
            type="button"
            onClick={() => {
              setMode('encode');
              resetOutputs();
            }}
            className={`rounded-lg border px-4 py-2 font-medium transition ${
              mode === 'encode'
                ? 'border-sky-500 bg-sky-500/20 text-sky-100 shadow-sm shadow-sky-500/20'
                : 'border-slate-700 bg-slate-900/60 text-slate-300 hover:border-slate-600 hover:text-sky-200'
            }`}
          >
            {t('bcs.mode.encode')}
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('decode');
              resetOutputs();
            }}
            className={`rounded-lg border px-4 py-2 font-medium transition ${
              mode === 'decode'
                ? 'border-sky-500 bg-sky-500/20 text-sky-100 shadow-sm shadow-sky-500/20'
                : 'border-slate-700 bg-slate-900/60 text-slate-300 hover:border-slate-600 hover:text-sky-200'
            }`}
          >
            {t('bcs.mode.decode')}
          </button>
        </div>

        <div className="space-y-3">
          <label className="flex flex-col gap-2 text-sm font-medium text-slate-200">
            {t('bcs.typeSelect.label')}
            <select
              className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100"
              value={primitive?.toString() || ''}
              onChange={(event) => {
                setPrimitive(event.target.value as SimpleEntryFunctionArgumentTypes);
                resetOutputs();
              }}
            >
              {PRIMITIVE_OPTIONS.map((item) => (
                <option key={item.value?.toString() || ''} value={item.value?.toString() || ''}>
                  {t(item.labelKey)}
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
          {mode === 'encode' ? t('bcs.actions.runEncode') : t('bcs.actions.runDecode')}
        </button>

        {error ? <p className="text-sm text-rose-400">{error}</p> : null}

        {result && (
          <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-900/60 p-5 text-sm text-slate-200">
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">{t('bcs.results.title')}</p>
              <p className="mt-1 break-all font-mono text-xs text-sky-300">{result}</p>
            </div>
            {auxiliary && (
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">{t('bcs.results.extraTitle')}</p>
                <p className="mt-1 break-all text-xs text-slate-300">{auxiliary}</p>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
