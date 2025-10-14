import { useCallback, useEffect, useMemo, useState } from 'react';
import { useWallet } from '@aptos-labs/wallet-adapter-react';
import type { InputEntryFunctionData } from '@aptos-labs/ts-sdk';

import { APTOS_NETWORKS, resolveRestEndpoint } from '../lib/networks';
import { fetchModuleAbi, getExplorerTxUrl, MoveModuleAbi, submitEntryFunction, waitForTransaction } from '../lib/aptos';
import { getTypeLabel, simplifyType, SimpleTypeTag } from '../lib/abi';
import { decodePrimitive, hexToBytes, toPrimitiveType } from '../lib/bcs';
import { useLanguage } from '../context/LanguageContext';
import { truncateAddress } from '../lib/address';

type ArgMode = 'raw' | 'hex' | 'bcs';
type SubmissionMode = 'wallet' | 'privateKey';

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

function extractTxnHash(value: unknown): string {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'object') {
    const hash = (value as Record<string, unknown>).hash ?? (value as Record<string, unknown>).transactionHash;
    if (typeof hash === 'string') return hash;
  }
  return '';
}

export default function AptosToolPage() {
  const { t } = useLanguage();
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
  const [submission, setSubmission] = useState<SubmissionState>({ status: 'idle' });

  const { connected, account, wallet: activeWallet, network: walletNetwork, signAndSubmitTransaction } = useWallet();

  const restEndpoint = useMemo(() => resolveRestEndpoint(networkId, customEndpoint), [networkId, customEndpoint]);
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

  const convertRawValue = useCallback(
    (tag: SimpleTypeTag, value: string) => {
      const trimmed = value.trim();
      if (!trimmed && tag.kind !== 'string' && tag.kind !== 'vector') {
        throw new Error(t('aptos.errors.parameterEmpty'));
      }
      switch (tag.kind) {
        case 'bool':
          if (trimmed === 'true' || trimmed === '1') return true;
          if (trimmed === 'false' || trimmed === '0') return false;
          throw new Error(t('aptos.errors.bool'));
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
          throw new Error(t('aptos.errors.vectorUnsupported'));
        default:
          throw new Error(t('aptos.errors.vectorUnsupported'));
      }
    },
    [t]
  );

  const convertHexValue = useCallback(
    (tag: SimpleTypeTag, value: string) => {
      if (!value.trim()) {
        throw new Error(t('aptos.errors.hexRequired'));
      }
      if (tag.kind === 'string') {
        const bytes = hexToBytes(value.trim());
        return new TextDecoder().decode(bytes);
      }
      if (tag.kind === 'vector' && tag.inner.kind === 'u8') {
        return hexToBytes(value.trim());
      }
      throw new Error(t('aptos.errors.hexUnsupported'));
    },
    [t]
  );

  const convertBcsValue = useCallback(
    (tag: SimpleTypeTag, value: string) => {
      if (!value.trim()) throw new Error(t('aptos.errors.bcsRequired'));
      const primitive = toPrimitiveType(tag);
      if (!primitive) {
        throw new Error(t('aptos.errors.bcsUnsupported'));
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
    },
    [t]
  );

  const loadModule = useCallback(async () => {
    if (!restEndpoint) {
      setModuleError(t('aptos.module.errors.missingEndpoint'));
      return;
    }
    if (!moduleId.includes('::')) {
      setModuleError(t('aptos.module.errors.invalidFormat'));
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
      const message = error instanceof Error ? error.message : String(error);
      setModuleError(t('aptos.messages.abiLoadError', { message }));
      setModuleAbi(null);
      setSelectedFunction('');
    } finally {
      setModuleLoading(false);
    }
  }, [moduleId, restEndpoint, t]);

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

  const buildArguments = useCallback(() => {
    const outputs: unknown[] = [];
    const errors: Array<string | undefined> = [];
    argStates.forEach((state, index) => {
      const tag = parameterTypes[index];
      if (!tag) {
        errors[index] = t('aptos.errors.missingTypeInfo', { index: index + 1 });
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
            errors[index] = t('aptos.errors.unknownMode');
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
      throw new Error(t('common.messages.parameterValidationFailed'));
    }

    return outputs;
  }, [argStates, convertBcsValue, convertHexValue, convertRawValue, parameterTypes, t]);

  const handleSubmit = async () => {
    if (!selectedFn || !moduleAbi) return;

    const trimmedTypeArgs = typeArgValues
      .map((item) => item.trim())
      .slice(0, selectedFn.generic_type_params.length);
    if (trimmedTypeArgs.length !== selectedFn.generic_type_params.length) {
      setSubmission({ status: 'error', message: t('aptos.submission.typeArgMismatch') });
      return;
    }
    if (trimmedTypeArgs.length > 0 && trimmedTypeArgs.some((value) => value.length === 0)) {
      setSubmission({ status: 'error', message: t('aptos.submission.typeArgMissing') });
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
      functionArguments: args as any[]
    };

    if (submissionMode === 'wallet') {
      if (!connected || !account) {
        setSubmission({ status: 'error', message: t('aptos.submission.walletRequired') });
        return;
      }
      setSubmission({ status: 'submitting' });
      try {
        const pending = await signAndSubmitTransaction({ sender: account.address, data: payload });
        const hash = extractTxnHash(pending);
        if (!hash) {
          setSubmission({ status: 'error', message: t('aptos.submission.walletHashMissing') });
          return;
        }

        if (restEndpoint) {
          try {
            await waitForTransaction(restEndpoint, hash);
          } catch (error) {
            console.warn('Failed to await transaction execution', error);
          }
        }

        const explorerUrl = getExplorerTxUrl({
          preferredNetwork: walletNetwork?.name ?? null,
          fallbackNetwork: networkId as 'mainnet' | 'testnet' | 'devnet' | 'custom',
          hash
        });
        setSubmission({ status: 'success', hash, explorerUrl, message: t('aptos.submission.success') });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setSubmission({ status: 'error', message });
      }
      return;
    }

    if (!privateKey.trim()) {
      setSubmission({ status: 'error', message: t('aptos.submission.privateKeyMissing') });
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

      const explorerUrl = getExplorerTxUrl({
        preferredNetwork: null,
        fallbackNetwork: networkId,
        hash: result.hash
      });
      setSubmission({ status: 'success', hash: result.hash, explorerUrl, message: t('aptos.submission.success') });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setSubmission({ status: 'error', message });
    }
  };

  const isSubmitting = submission.status === 'submitting';
  const disableSubmit = isSubmitting || (submissionMode === 'wallet' && !connected);

  const walletNetworkLabel = (walletNetwork?.name as string) ?? t('aptos.signing.unknownNetwork');

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">{t('aptos.title')}</h1>
        <p className="text-slate-300">{t('aptos.description')}</p>
      </header>

      <section className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="flex flex-col gap-2 text-sm font-medium text-slate-200">
            {t('aptos.network.label')}
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
              <option value="custom">{t('aptos.network.customOption')}</option>
            </select>
          </label>

          {networkId === 'custom' ? (
            <label className="flex flex-col gap-2 text-sm font-medium text-slate-200">
              {t('aptos.network.customLabel')}
              <input
                className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100"
                placeholder={t('aptos.network.customPlaceholder')}
                value={customEndpoint}
                onChange={(event) => setCustomEndpoint(event.target.value)}
              />
            </label>
          ) : (
            <div className="flex flex-col gap-2 text-sm text-slate-400">
              <span className="font-medium text-slate-300">{t('aptos.network.restLabel')}</span>
              <span className="truncate rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-xs">
                {resolveRestEndpoint(networkId)}
              </span>
            </div>
          )}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="flex flex-col gap-2 text-sm font-medium text-slate-200">
            {t('aptos.module.label')}
            <input
              className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100"
              placeholder={t('aptos.module.placeholder')}
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
            {moduleLoading ? t('aptos.module.loading') : t('aptos.module.load')}
          </button>
        </div>
        {moduleError ? <p className="text-sm text-rose-400">{moduleError}</p> : null}
      </section>

      {moduleAbi && (
        <section className="space-y-6">
          <div className="space-y-3">
            <h2 className="text-xl font-semibold text-slate-100">{t('aptos.functions.title')}</h2>
            {entryFunctions.length === 0 ? (
              <p className="text-sm text-slate-400">{t('aptos.functions.empty')}</p>
            ) : (
              <select
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100"
                value={selectedFunction}
                onChange={(event) => setSelectedFunction(event.target.value)}
              >
                {entryFunctions.map((fn) => (
                  <option key={fn.name} value={fn.name}>
                    {t('aptos.functions.optionLabel', {
                      name: fn.name,
                      count: fn.params.filter((param) => !isSignerParameter(param)).length
                    })}
                  </option>
                ))}
              </select>
            )}
          </div>

          {selectedFn && (
            <div className="space-y-8">
              {selectedFn.generic_type_params.length > 0 ? (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-slate-200">{t('aptos.typeArgs.title')}</h3>
                  {typeArgValues.map((value, index) => (
                    <label key={index} className="flex flex-col gap-2 text-sm font-medium text-slate-200">
                      {t('aptos.typeArgs.label', { index })}
                      <input
                        className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100"
                        placeholder={t('aptos.typeArgs.placeholder')}
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
                  <p className="text-xs text-slate-400">{t('aptos.typeArgs.hint')}</p>
                </div>
              ) : null}

              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-slate-200">{t('aptos.arguments.title')}</h3>
                {callableParams.length === 0 ? (
                  <p className="text-sm text-slate-400">{t('aptos.arguments.none')}</p>
                ) : (
                  <div className="space-y-6">
                    {callableParams.map((param, index) => {
                      const tag = parameterTypes[index];
                      const state = argStates[index];
                      const typeLabel = getTypeLabel(tag);
                      const primitive = toPrimitiveType(tag);
                      const supportsHex = tag.kind === 'string' || (tag.kind === 'vector' && tag.inner.kind === 'u8');
                      const supportsBcs = Boolean(primitive);

                      return (
                        <div key={`${param}-${index}`} className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 shadow-inner">
                          <div className="flex flex-col gap-2 text-sm text-slate-300">
                            <span className="font-semibold text-slate-100">{t('aptos.arguments.label', { index: index + 1 })}</span>
                            <span className="text-xs uppercase tracking-wide text-slate-500">{t('aptos.arguments.type', { type: typeLabel })}</span>
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
                              {t('aptos.arguments.modes.raw')}
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
                              {t('aptos.arguments.modes.hex')}
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
                              {t('aptos.arguments.modes.bcs')}
                            </button>
                          </div>

                          {state?.mode === 'raw' && (
                            <div className="mt-4">
                              <textarea
                                className="min-h-[90px] w-full rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm text-slate-100"
                                placeholder={tag.kind === 'string' ? t('aptos.arguments.placeholders.rawString') : t('aptos.arguments.placeholders.rawGeneric')}
                                value={state.rawValue}
                                onChange={(event) => handleArgValueChange(index, 'rawValue', event.target.value)}
                              />
                              {tag.kind === 'vector' && tag.inner.kind === 'u8' ? (
                                <p className="mt-1 text-xs text-slate-500">{t('aptos.arguments.hints.rawVector')}</p>
                              ) : null}
                            </div>
                          )}

                          {state?.mode === 'hex' && (
                            <div className="mt-4">
                              <textarea
                                className="min-h-[90px] w-full rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm text-slate-100"
                                placeholder={t('aptos.arguments.placeholders.hex')}
                                value={state.hexValue}
                                onChange={(event) => handleArgValueChange(index, 'hexValue', event.target.value)}
                              />
                              <p className="mt-1 text-xs text-slate-500">{t('aptos.arguments.hints.hex')}</p>
                            </div>
                          )}

                          {state?.mode === 'bcs' && (
                            <div className="mt-4">
                              <textarea
                                className="min-h-[90px] w-full rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm text-slate-100"
                                placeholder={t('aptos.arguments.placeholders.bcs')}
                                value={state.bcsValue}
                                onChange={(event) => handleArgValueChange(index, 'bcsValue', event.target.value)}
                              />
                              <p className="mt-1 text-xs text-slate-500">{t('aptos.arguments.hints.bcs')}</p>
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
                  <h3 className="text-sm font-semibold text-slate-200">{t('aptos.signing.title')}</h3>
                  <div className="flex flex-wrap gap-2 text-xs">
                    <button
                      type="button"
                      onClick={() => setSubmissionMode('wallet')}
                      className={`rounded-full px-3 py-1 transition ${
                        submissionMode === 'wallet' ? 'bg-sky-500/30 text-sky-200' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      {t('aptos.signing.wallet')}
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
                      {t('aptos.signing.privateKey')}
                    </button>
                  </div>

                  {submissionMode === 'wallet' ? (
                    <div className="space-y-3 text-sm text-slate-200">
                      {connected && activeWallet ? (
                        <div className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900/60 px-3 py-1 text-xs text-slate-300">
                          <span className="font-semibold text-slate-100">{activeWallet.name}</span>
                          <span className="text-slate-500">{truncateAddress(account?.address)}</span>
                          <span className="text-slate-600">/ {walletNetworkLabel}</span>
                        </div>
                      ) : (
                        <p className="text-xs text-slate-400">{t('aptos.signing.reminderConnectAbove')}</p>
                      )}
                      {networkMismatch ? (
                        <p className="text-xs text-amber-400">
                          {t('aptos.signing.networkMismatch', {
                            walletNetwork: walletNetworkLabel,
                            selectedNetwork: networkId
                          })}
                        </p>
                      ) : null}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <label className="flex flex-col gap-2 text-sm font-medium text-slate-200">
                        {t('aptos.privateKey.label')}
                        <textarea
                          className="min-h-[80px] rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
                          placeholder={t('aptos.privateKey.placeholder')}
                          value={privateKey}
                          onChange={(event) => setPrivateKey(event.target.value)}
                        />
                      </label>
                      <p className="text-xs text-slate-500">{t('aptos.privateKey.hint')}</p>
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
                    {isSubmitting ? t('common.actions.submitting') : t('common.actions.submit')}
                  </button>
                  {submission.status === 'error' && submission.message ? (
                    <p className="text-sm text-rose-400">{submission.message}</p>
                  ) : null}
                  {submission.status === 'success' && submission.hash ? (
                    <div className="space-y-2 rounded-lg border border-slate-800 bg-slate-900/60 p-4 text-sm text-slate-200">
                      {submission.message ? <p className="text-slate-300">{submission.message}</p> : null}
                      <p>
                        {t('aptos.submission.hashLabel')}：<span className="break-all text-sky-300">{submission.hash}</span>
                      </p>
                      {submission.explorerUrl ? (
                        <a
                          className="inline-flex items-center text-sky-400 hover:text-sky-300"
                          href={submission.explorerUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {t('common.actions.viewOnExplorer')}
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
