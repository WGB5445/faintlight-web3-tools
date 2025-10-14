import { useCallback, useEffect, useMemo, useState } from 'react';
import { APTOS_NETWORKS, resolveRestEndpoint } from '../lib/networks';
import { fetchModuleAbi, getExplorerTxUrl, MoveModuleAbi, submitEntryFunction } from '../lib/aptos';
import { getTypeLabel, simplifyType, SimpleTypeTag } from '../lib/abi';
import { decodePrimitive, hexToBytes, toPrimitiveType } from '../lib/bcs';

type ArgMode = 'raw' | 'hex' | 'bcs';

interface ArgState {
  mode: ArgMode;
  rawValue: string;
  hexValue: string;
  bcsValue: string;
  error?: string;
}

interface SubmissionState {
  status: 'idle' | 'submitting' | 'success' | 'error';
  hash?: string;
  explorerUrl?: string | null;
  message?: string;
}

function isSignerParameter(param: string) {
  const cleaned = param.replace('&mut ', '').replace('&', '').trim();
  return cleaned === 'signer';
}

function createInitialArgs(params: string[]): ArgState[] {
  return params.map(() => ({ mode: 'raw', rawValue: '', hexValue: '', bcsValue: '' }));
}

function convertRawValue(tag: SimpleTypeTag, value: string) {
  const trimmed = value.trim();
  if (!trimmed && tag.kind !== 'string' && tag.kind !== 'vector') {
    throw new Error('参数不能为空');
  }
  switch (tag.kind) {
    case 'bool':
      if (trimmed === 'true' || trimmed === '1') return true;
      if (trimmed === 'false' || trimmed === '0') return false;
      throw new Error('布尔值仅接受 true/false 或 1/0');
    case 'u8':
    case 'u16':
    case 'u32':
    case 'u64':
    case 'u128':
    case 'u256':
      return trimmed;
    case 'address':
      return trimmed.startsWith('0x') ? trimmed : `0x${trimmed}`;
    case 'string':
      return value;
    case 'vector':
      if (tag.inner.kind === 'u8') {
        return new TextEncoder().encode(value);
      }
      throw new Error('暂不支持该 vector 类型的原始输入');
    default:
      throw new Error('暂不支持此类型的原始输入');
  }
}

function convertHexValue(tag: SimpleTypeTag, value: string) {
  if (!value.trim()) {
    throw new Error('请填写 Hex 字符串');
  }
  if (tag.kind === 'string') {
    const bytes = hexToBytes(value.trim());
    return new TextDecoder().decode(bytes);
  }
  if (tag.kind === 'vector' && tag.inner.kind === 'u8') {
    return hexToBytes(value.trim());
  }
  throw new Error('该类型不支持 Hex Vector 输入');
}

function convertBcsValue(tag: SimpleTypeTag, value: string) {
  if (!value.trim()) throw new Error('请填写 BCS Hex 数据');
  const primitive = toPrimitiveType(tag);
  if (!primitive) {
    throw new Error('暂未实现该类型的 BCS 解析');
  }
  const decoded = decodePrimitive(primitive, hexToBytes(value.trim()));
  if (primitive.startsWith('u')) {
    return decoded.toString();
  }
  if (primitive === 'bool' || primitive === 'string' || primitive === 'address') {
    return decoded;
  }
  if (primitive === 'vector<u8>') {
    return hexToBytes(decoded as string);
  }
  return decoded;
}

export default function AptosToolPage() {
  const [networkId, setNetworkId] = useState<'mainnet' | 'testnet' | 'devnet' | 'custom'>('testnet');
  const [customEndpoint, setCustomEndpoint] = useState('');
  const [moduleId, setModuleId] = useState('');
  const [moduleLoading, setModuleLoading] = useState(false);
  const [moduleError, setModuleError] = useState<string | null>(null);
  const [moduleAbi, setModuleAbi] = useState<MoveModuleAbi | null>(null);
  const [selectedFunction, setSelectedFunction] = useState<string>('');
  const [typeArgValues, setTypeArgValues] = useState<string[]>([]);
  const [argStates, setArgStates] = useState<ArgState[]>([]);
  const [privateKey, setPrivateKey] = useState('');
  const [submission, setSubmission] = useState<SubmissionState>({ status: 'idle' });

  const restEndpoint = useMemo(() => resolveRestEndpoint(networkId, customEndpoint), [networkId, customEndpoint]);

  const entryFunctions = useMemo(() => {
    if (!moduleAbi) return [];
    return moduleAbi.exposed_functions.filter((fn) => fn.is_entry);
  }, [moduleAbi]);

  const selectedFn = useMemo(() => entryFunctions.find((fn) => fn.name === selectedFunction), [entryFunctions, selectedFunction]);

  const callableParams = useMemo(() => {
    if (!selectedFn) return [] as string[];
    return selectedFn.params.filter((param) => !isSignerParameter(param));
  }, [selectedFn]);

  const parameterTypes = useMemo(() => callableParams.map((param) => simplifyType(param)), [callableParams]);

  useEffect(() => {
    if (!selectedFn) {
      setArgStates([]);
      setTypeArgValues([]);
      return;
    }
    const newArgs = createInitialArgs(callableParams);
    setArgStates(newArgs);
    setTypeArgValues(Array(selectedFn.generic_type_params.length).fill(''));
  }, [selectedFn, callableParams]);

  const loadModule = useCallback(async () => {
    if (!restEndpoint) {
      setModuleError('请先配置有效的节点地址');
      return;
    }
    if (!moduleId.includes('::')) {
      setModuleError('模块 ID 需要 address::module 格式');
      return;
    }
    setModuleLoading(true);
    setModuleError(null);
    try {
      const abi = await fetchModuleAbi(restEndpoint, moduleId);
      setModuleAbi(abi);
      const firstEntry = abi.exposed_functions.find((fn) => fn.is_entry);
      setSelectedFunction(firstEntry?.name ?? '');
      setSubmission({ status: 'idle' });
    } catch (error) {
      setModuleError(error instanceof Error ? error.message : String(error));
      setModuleAbi(null);
      setSelectedFunction('');
    } finally {
      setModuleLoading(false);
    }
  }, [moduleId, restEndpoint]);

  const handleArgModeChange = (index: number, mode: ArgMode) => {
    setArgStates((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], mode, error: undefined };
      return next;
    });
  };

  const handleArgValueChange = (index: number, key: keyof ArgState, value: string) => {
    setArgStates((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [key]: value, error: undefined };
      return next;
    });
  };

  const buildArguments = () => {
    const outputs: unknown[] = [];
    const errors: Array<string | undefined> = [];
    argStates.forEach((state, index) => {
      const tag = parameterTypes[index];
      if (!tag) {
        errors[index] = `缺少第 ${index + 1} 个参数的类型信息`;
        return;
      }
      try {
        switch (state.mode) {
          case 'raw':
            outputs[index] = convertRawValue(tag, state.rawValue);
            break;
          case 'hex':
            outputs[index] = convertHexValue(tag, state.hexValue);
            break;
          case 'bcs':
            outputs[index] = convertBcsValue(tag, state.bcsValue);
            break;
          default:
            errors[index] = '未知的参数模式';
        }
      } catch (error) {
        errors[index] = error instanceof Error ? error.message : String(error);
      }
    });

    const hasError = errors.some(Boolean);
    if (hasError) {
      setArgStates((prev) =>
        prev.map((state, idx) => ({
          ...state,
          error: errors[idx]
        }))
      );
      throw new Error('参数校验失败，请检查输入。');
    }

    return outputs;
  };

  const handleSubmit = async () => {
    if (!selectedFn || !moduleAbi) return;
    if (!privateKey.trim()) {
      setSubmission({ status: 'error', message: '请输入发送者私钥（Hex）' });
      return;
    }
    const trimmedTypeArgs = typeArgValues.map((item) => item.trim());
    if (trimmedTypeArgs.length !== selectedFn.generic_type_params.length) {
      setSubmission({ status: 'error', message: '类型参数数量与 ABI 不匹配。' });
      return;
    }
    if (trimmedTypeArgs.some((value) => value.length === 0)) {
      setSubmission({ status: 'error', message: '请补全所有类型参数。' });
      return;
    }
    try {
      const args = buildArguments();
      const data = {
        function: `${moduleAbi.address}::${moduleAbi.name}::${selectedFn.name}`,
        typeArguments: trimmedTypeArgs,
        functionArguments: args
      } as const;

      setSubmission({ status: 'submitting' });
      const result = await submitEntryFunction({
        senderPrivateKeyHex: privateKey.trim(),
        restUrl: restEndpoint,
        networkId,
        data
      });

      const explorerUrl = getExplorerTxUrl(networkId, result.hash);
      setSubmission({ status: 'success', hash: result.hash, explorerUrl });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setSubmission({ status: 'error', message });
    }
  };

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Aptos 合约交互</h1>
        <p className="text-slate-300">
          选择网络与模块后自动检索 ABI，针对每个函数参数提供原始值、Hex Vector 与 BCS Hex 三种输入模式，最后一键提交交易。
        </p>
      </header>

      <section className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="flex flex-col gap-2 text-sm font-medium text-slate-200">
            网络选择
            <select
              className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100"
              value={networkId}
              onChange={(event) => setNetworkId(event.target.value as typeof networkId)}
            >
              {APTOS_NETWORKS.map((network) => (
                <option key={network.id} value={network.id}>
                  {network.label}
                </option>
              ))}
              <option value="custom">自定义</option>
            </select>
          </label>

          {networkId === 'custom' ? (
            <label className="flex flex-col gap-2 text-sm font-medium text-slate-200">
              Fullnode URL
              <input
                className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100"
                placeholder="https://your-fullnode/v1"
                value={customEndpoint}
                onChange={(event) => setCustomEndpoint(event.target.value)}
              />
            </label>
          ) : (
            <div className="flex flex-col gap-2 text-sm text-slate-400">
              <span className="font-medium text-slate-300">节点地址</span>
              <span className="truncate rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-xs">
                {resolveRestEndpoint(networkId)}
              </span>
            </div>
          )}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="flex flex-col gap-2 text-sm font-medium text-slate-200">
            模块 ID
            <input
              className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100"
              placeholder="0x1::coin"
              value={moduleId}
              onChange={(event) => setModuleId(event.target.value)}
            />
          </label>
          <button
            type="button"
            onClick={loadModule}
            className="self-end rounded-lg bg-sky-500 px-4 py-2 text-sm font-medium text-slate-950 transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
            disabled={moduleLoading}
          >
            {moduleLoading ? '检索中...' : '加载 ABI'}
          </button>
        </div>
        {moduleError ? <p className="text-sm text-rose-400">{moduleError}</p> : null}
      </section>

      {moduleAbi && (
        <section className="space-y-6">
          <div className="space-y-3">
            <h2 className="text-xl font-semibold text-slate-100">函数选择</h2>
            {entryFunctions.length === 0 ? (
              <p className="text-sm text-slate-400">该模块没有暴露 entry 函数。</p>
            ) : (
              <select
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100"
                value={selectedFunction}
                onChange={(event) => setSelectedFunction(event.target.value)}
              >
                {entryFunctions.map((fn) => (
                  <option key={fn.name} value={fn.name}>
                    {fn.name}({fn.params.filter((param) => !isSignerParameter(param)).length} params)
                  </option>
                ))}
              </select>
            )}
          </div>

          {selectedFn && (
            <div className="space-y-8">
              {selectedFn.generic_type_params.length > 0 ? (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-slate-200">类型参数</h3>
                  {typeArgValues.map((value, index) => (
                    <label key={index} className="flex flex-col gap-2 text-sm font-medium text-slate-200">
                      T{index}
                      <input
                        className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100"
                        placeholder="例如 0x1::coin::CoinInfo"
                        value={value}
                        onChange={(event) =>
                          setTypeArgValues((prev) => {
                            const next = [...prev];
                            next[index] = event.target.value;
                            return next;
                          })
                        }
                      />
                    </label>
                  ))}
                  <p className="text-xs text-slate-400">类型参数需要完整的结构体或原语描述，比如 <code>0x1::coin::CoinInfo&lt;0x1::aptos_coin::AptosCoin&gt;</code>。</p>
                </div>
              ) : null}

              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-slate-200">参数输入</h3>
                {callableParams.length === 0 ? (
                  <p className="text-sm text-slate-400">该函数不需要额外参数。</p>
                ) : (
                  <div className="space-y-6">
                    {callableParams.map((param, index) => {
                      const tag = parameterTypes[index];
                      const state = argStates[index];
                      const label = `参数 ${index + 1}`;
                      const typeLabel = getTypeLabel(tag);
                      const primitive = toPrimitiveType(tag);
                      const supportsHex = tag.kind === 'string' || (tag.kind === 'vector' && tag.inner.kind === 'u8');
                      const supportsBcs = Boolean(primitive);

                      return (
                        <div key={`${param}-${index}`} className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 shadow-inner">
                          <div className="flex flex-col gap-2 text-sm text-slate-300">
                            <span className="font-semibold text-slate-100">{label}</span>
                            <span className="text-xs uppercase tracking-wide text-slate-500">类型：{typeLabel}</span>
                          </div>
                          <div className="mt-3 flex flex-wrap gap-2 text-xs">
                            <button
                              type="button"
                              onClick={() => handleArgModeChange(index, 'raw')}
                              className={`rounded-full px-3 py-1 transition ${
                                state?.mode === 'raw'
                                  ? 'bg-sky-500/30 text-sky-200'
                                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                              }`}
                            >
                              原始值
                            </button>
                            <button
                              type="button"
                              disabled={!supportsHex}
                              onClick={() => handleArgModeChange(index, 'hex')}
                              className={`rounded-full px-3 py-1 transition ${
                                state?.mode === 'hex'
                                  ? 'bg-sky-500/30 text-sky-200'
                                  : supportsHex
                                      ? 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                                      : 'bg-slate-800 text-slate-500 line-through'
                              }`}
                            >
                              Hex Vector
                            </button>
                            <button
                              type="button"
                              disabled={!supportsBcs}
                              onClick={() => handleArgModeChange(index, 'bcs')}
                              className={`rounded-full px-3 py-1 transition ${
                                state?.mode === 'bcs'
                                  ? 'bg-sky-500/30 text-sky-200'
                                  : supportsBcs
                                      ? 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                                      : 'bg-slate-800 text-slate-500 line-through'
                              }`}
                            >
                              BCS Hex
                            </button>
                          </div>

                          {state?.mode === 'raw' && (
                            <div className="mt-4">
                              <textarea
                                className="min-h-[90px] w-full rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm text-slate-100"
                                placeholder={tag.kind === 'string' ? '输入原始字符串' : '输入与类型匹配的值'}
                                value={state.rawValue}
                                onChange={(event) => handleArgValueChange(index, 'rawValue', event.target.value)}
                              />
                              {tag.kind === 'vector' && tag.inner.kind === 'u8' ? (
                                <p className="mt-1 text-xs text-slate-500">原始模式会按 UTF-8 将文本转换为字节数组。</p>
                              ) : null}
                            </div>
                          )}

                          {state?.mode === 'hex' && (
                            <div className="mt-4">
                              <textarea
                                className="min-h-[90px] w-full rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm text-slate-100"
                                placeholder="0x..."
                                value={state.hexValue}
                                onChange={(event) => handleArgValueChange(index, 'hexValue', event.target.value)}
                              />
                              <p className="mt-1 text-xs text-slate-500">Hex Vector 会先转换为实际的字节或字符串。</p>
                            </div>
                          )}

                          {state?.mode === 'bcs' && (
                            <div className="mt-4">
                              <textarea
                                className="min-h-[90px] w-full rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm text-slate-100"
                                placeholder="BCS 序列化后的 Hex"
                                value={state.bcsValue}
                                onChange={(event) => handleArgValueChange(index, 'bcsValue', event.target.value)}
                              />
                              <p className="mt-1 text-xs text-slate-500">系统会反序列化该 BCS 数据以生成最终参数。</p>
                            </div>
                          )}

                          {state?.error ? <p className="mt-2 text-xs text-rose-400">{state.error}</p> : null}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <label className="flex flex-col gap-2 text-sm font-medium text-slate-200">
                  发送者私钥（Hex）
                  <textarea
                    className="min-h-[80px] rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
                    placeholder="0x..."
                    value={privateKey}
                    onChange={(event) => setPrivateKey(event.target.value.trim())}
                  />
                </label>
                <p className="text-xs text-slate-500">
                  私钥仅用于当前浏览器内的签名请求，请确保在安全环境下使用。
                </p>
              </div>

              <div className="flex flex-col gap-3">
                <button
                  type="button"
                  onClick={handleSubmit}
                  className="w-full rounded-lg bg-sky-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
                  disabled={submission.status === 'submitting'}
                >
                  {submission.status === 'submitting' ? '提交中...' : '提交交易'}
                </button>
                {submission.status === 'error' && submission.message ? (
                  <p className="text-sm text-rose-400">{submission.message}</p>
                ) : null}
                {submission.status === 'success' && submission.hash ? (
                  <div className="space-y-2 rounded-lg border border-slate-800 bg-slate-900/60 p-4 text-sm text-slate-200">
                    <p>交易哈希：<span className="break-all text-sky-300">{submission.hash}</span></p>
                    {submission.explorerUrl ? (
                      <a
                        className="inline-flex items-center text-sky-400 hover:text-sky-300"
                        href={submission.explorerUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        在 Aptos Explorer 中查看
                      </a>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
