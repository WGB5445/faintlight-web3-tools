import { useCallback, useEffect, useMemo, useState } from 'react';
import { useWallet, WalletReadyState } from '@aptos-labs/wallet-adapter-react';
import type { InputEntryFunctionData } from '@aptos-labs/ts-sdk';

import { APTOS_NETWORKS, resolveRestEndpoint } from '../lib/networks';
import { fetchModuleAbi, getExplorerTxUrl, MoveModuleAbi, submitEntryFunction, waitForTransaction } from '../lib/aptos';
import { getTypeLabel, simplifyType, SimpleTypeTag } from '../lib/abi';
import { decodePrimitive, hexToBytes, toPrimitiveType } from '../lib/bcs';

type ArgMode = 'raw' | 'hex' | 'bcs';
type SubmissionMode = 'wallet' | 'privateKey';

type WalletItem = ReturnType<typeof useWallet>['wallets'][number];

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

function truncateAddress(address: string) {
  if (address.length <= 12) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function extractTxnHash(value: unknown): string {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'object') {
    const hash = (value as Record<string, unknown>).hash ?? (value as Record<string, unknown>).transactionHash;
    if (typeof hash === 'string') return hash;
  }
  return '';
}

function isWalletSelectable(wallet: WalletItem) {
  return wallet.readyState === WalletReadyState.Installed || wallet.readyState === WalletReadyState.Loadable;
}

export default function AptosToolPage() {
  const [networkId, setNetworkId] = useState<'mainnet' | 'testnet' | 'devnet' | 'custom'>('testnet');
  const [submissionMode, setSubmissionMode] = useState<SubmissionMode>('wallet');
  const [customEndpoint, setCustomEndpoint] = useState('');
  const [moduleId, setModuleId] = useState('');
  const [moduleLoading, setModuleLoading] = useState(false);
  const [moduleError, setModuleError] = useState<string | null>(null);
  const [moduleAbi, setModuleAbi] = useState<MoveModuleAbi | null>(null);
  const [selectedFunction, setSelectedFunction] = useState<string>('');
  const [typeArgValues, setTypeArgValues] = useState<string[]>([]);
  const [argStates, setArgStates] = useState<ArgState[]>([]);
  const [privateKey, setPrivateKey] = useState('');
  const [walletFeedback, setWalletFeedback] = useState<string | null>(null);
  const [submission, setSubmission] = useState<SubmissionState>({ status: 'idle' });

  const wallet = useWallet();
  const { wallets, connect, disconnect, connected, account, wallet: activeWallet, network: walletNetwork, signAndSubmitTransaction } = wallet;

  const restEndpoint = useMemo(() => resolveRestEndpoint(networkId, customEndpoint), [networkId, customEndpoint]);

  const availableWallets = useMemo(() => wallets.filter(isWalletSelectable), [wallets]);
  const walletAddress = account?.address ?? '';
  const normalizedWalletNetwork = walletNetwork?.name ? walletNetwork.name.toLowerCase() : null;
  const networkMismatch =
    submissionMode === 'wallet' && normalizedWalletNetwork && networkId !== 'custom' && normalizedWalletNetwork !== networkId;

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

  const handleWalletConnect = async (walletName: string) => {
    try {
      setWalletFeedback(null);
      await connect(walletName);
    } catch (error) {
      setWalletFeedback(error instanceof Error ? error.message : String(error));
    }
  };

  const handleWalletDisconnect = async () => {
    try {
      await disconnect();
      setWalletFeedback(null);
    } catch (error) {
      setWalletFeedback(error instanceof Error ? error.message : String(error));
    }
  };

  const handleSubmit = async () => {
    if (!selectedFn || !moduleAbi) return;

    const trimmedTypeArgs = typeArgValues.map((item) => item.trim()).slice(0, selectedFn.generic_type_params.length);
    if (trimmedTypeArgs.length !== selectedFn.generic_type_params.length) {
      setSubmission({ status: 'error', message: '类型参数数量与 ABI 不匹配。' });
      return;
    }
    if (trimmedTypeArgs.length > 0 && trimmedTypeArgs.some((value) => value.length === 0)) {
      setSubmission({ status: 'error', message: '请补全所有类型参数。' });
      return;
    }

    let args: unknown[];
    try {
      args = buildArguments();
    } catch (error) {
      setSubmission({ status: 'error', message: error instanceof Error ? error.message : String(error) });
      return;
    }

    const payload: InputEntryFunctionData = {
      function: `${moduleAbi.address}::${moduleAbi.name}::${selectedFn.name}`,
      typeArguments: trimmedTypeArgs,
      functionArguments: args
    };

    if (submissionMode === 'wallet') {
      if (!connected || !account) {
        setSubmission({ status: 'error', message: '请先连接支持的 Aptos 钱包。' });
        return;
      }
      setSubmission({ status: 'submitting' });
      try {
        const pending = await signAndSubmitTransaction({ sender: account.address, data: payload });
        const hash = extractTxnHash(pending);
        if (!hash) {
          setSubmission({ status: 'error', message: '钱包未返回有效的交易哈希。' });
          return;
        }

        if (restEndpoint) {
          try {
            await waitForTransaction(restEndpoint, hash);
          } catch (error) {
            console.warn('等待交易确认失败:', error);
          }
        }

        const explorerUrl = getExplorerTxUrl(networkId, hash);
        setSubmission({ status: 'success', hash, explorerUrl });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setSubmission({ status: 'error', message });
      }
      return;
    }

    if (!privateKey.trim()) {
      setSubmission({ status: 'error', message: '请输入发送者私钥（Hex）。' });
      return;
    }

    try {
      setSubmission({ status: 'submitting' });
      const result = await submitEntryFunction({
        senderPrivateKeyHex: privateKey.trim(),
        restUrl: restEndpoint,
        networkId,
        data: payload
      });

      const explorerUrl = getExplorerTxUrl(networkId, result.hash);
      setSubmission({ status: 'success', hash: result.hash, explorerUrl });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setSubmission({ status: 'error', message });
    }
  };

  const isSubmitting = submission.status === 'submitting';
  const disableSubmit = isSubmitting || (submissionMode === 'wallet' && !connected);

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Aptos 合约交互</h1>
        <p className="text-slate-300">
          连接 Aptos 钱包或使用私钥签名，加载合约 ABI 后即可根据参数类型自动生成输入表单并构建交易。
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

              <div className="space-y-5">
                <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-900/60 p-4">
                  <h3 className="text-sm font-semibold text-slate-200">签名方式</h3>
                  <div className="flex flex-wrap gap-2 text-xs">
                    <button
                      type="button"
                      onClick={() => setSubmissionMode('wallet')}
                      className={`rounded-full px-3 py-1 transition ${
                        submissionMode === 'wallet' ? 'bg-sky-500/30 text-sky-200' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      Aptos 钱包
                    </button>
                    <button
                      type="button"
                      onClick={() => setSubmissionMode('privateKey')}
                      className={`rounded-full px-3 py-1 transition ${
                        submissionMode === 'privateKey'
                          ? 'bg-sky-500/30 text-sky-200'
                          : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      私钥签名
                    </button>
                  </div>

                  {submissionMode === 'wallet' ? (
                    <div className="space-y-3 text-sm text-slate-200">
                      {connected && activeWallet ? (
                        <div className="flex flex-col gap-2 rounded-lg border border-slate-800/80 bg-slate-950/60 px-4 py-3">
                          <div className="flex items-center justify-between text-xs text-slate-300">
                            <span className="font-medium text-slate-100">已连接钱包</span>
                            <span className="rounded-full bg-sky-500/20 px-2 py-0.5 text-[11px] text-sky-200">{activeWallet.name}</span>
                          </div>
                          <div className="text-xs text-slate-400">
                            地址：<span className="text-sky-300">{truncateAddress(walletAddress)}</span>
                          </div>
                          <div className="flex items-center justify-between text-xs text-slate-400">
                            <span>钱包网络：{walletNetwork?.name ?? '未知'}</span>
                            <button
                              type="button"
                              onClick={handleWalletDisconnect}
                              className="rounded-lg border border-slate-700 px-3 py-1 text-xs text-slate-300 transition hover:border-rose-600 hover:text-rose-300"
                            >
                              断开连接
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <p className="text-xs text-slate-400">选择已安装的钱包进行连接（当前已集成 Aptos Wallet Adapter React）。</p>
                          <div className="grid gap-2 sm:grid-cols-2">
                            {availableWallets.length > 0 ? (
                              availableWallets.map((item) => (
                                <button
                                  key={item.name}
                                  type="button"
                                  onClick={() => handleWalletConnect(item.name)}
                                  className="flex flex-col items-start gap-1 rounded-lg border border-slate-800 bg-slate-950/60 px-4 py-3 text-left text-xs text-slate-300 transition hover:border-sky-500/60 hover:text-sky-200"
                                >
                                  <span className="text-sm font-medium text-slate-100">{item.name}</span>
                                  <span className="text-xs text-slate-500">状态：{item.readyState}</span>
                                </button>
                              ))
                            ) : (
                              <div className="rounded-lg border border-slate-800 bg-slate-950/60 px-4 py-3 text-xs text-slate-400">
                                未检测到兼容钱包，请先安装 Petra 等 Aptos 钱包插件。
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {walletFeedback ? <p className="text-xs text-rose-400">{walletFeedback}</p> : null}
                      {networkMismatch ? (
                        <p className="text-xs text-amber-400">
                          当前钱包网络为 {walletNetwork?.name ?? '未知'}，与工具选择的 {networkId} 不一致，提交后可能失败，请确认。
                        </p>
                      ) : null}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <label className="flex flex-col gap-2 text-sm font-medium text-slate-200">
                        发送者私钥（Hex）
                        <textarea
                          className="min-h-[80px] rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
                          placeholder="0x..."
                          value={privateKey}
                          onChange={(event) => setPrivateKey(event.target.value)}
                        />
                      </label>
                      <p className="text-xs text-slate-500">私钥仅用于当前浏览器内的签名请求，请确保在安全环境下使用。</p>
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-3">
                  <button
                    type="button"
                    onClick={handleSubmit}
                    className="w-full rounded-lg bg-sky-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
                    disabled={disableSubmit}
                  >
                    {isSubmitting ? '提交中...' : '提交交易'}
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
            </div>
          )}
        </section>
      )}
    </div>
  );
}
