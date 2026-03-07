import { Fragment, useEffect, useMemo, useState } from "react";
import { useLanguage } from "../../context/LanguageContext";
import { truncateAddress } from "../../lib/address";

type WalletOption = {
  name: string;
  readyState: string;
};

interface AptosWalletButtonProps {
  connected: boolean;
  walletName: string | null;
  address: string;
  networkLabel: string;
  restUrl?: string | null;
  availableWallets: WalletOption[];
  onConnect: (walletName: string) => Promise<void>;
  onDisconnect: () => Promise<void>;
}

type BalanceState = {
  loading: boolean;
  value: string | null;
  error: string | null;
};

const RESOURCE_TYPE = "0x1::coin::CoinStore<0x1::aptos_coin::AptosCoin>";

async function fetchAptBalance(
  restUrl: string,
  accountAddress: string,
): Promise<string> {
  const endpoint = restUrl.replace(/\/$/, "");
  const resourceUrl = `${endpoint}/accounts/${accountAddress}/resource/${encodeURIComponent(RESOURCE_TYPE)}`;
  const response = await fetch(resourceUrl);
  if (response.status === 404) {
    return "0";
  }
  if (!response.ok) {
    throw new Error(`Failed to fetch balance: ${response.status}`);
  }
  const json = await response.json();
  const value = json?.data?.coin?.value;
  if (typeof value !== "string") {
    throw new Error("Invalid balance response");
  }
  return value;
}

function formatApt(value: string) {
  try {
    const raw = BigInt(value);
    const integer = raw / 100000000n;
    const fraction = raw % 100000000n;
    if (fraction === 0n) {
      return `${integer.toString()} APT`;
    }
    const fractionStr = fraction.toString().padStart(8, "0").replace(/0+$/, "");
    return `${integer.toString()}.${fractionStr} APT`;
  } catch (error) {
    return `${value} (octas)`;
  }
}

export default function AptosWalletButton({
  connected,
  walletName,
  address,
  networkLabel,
  restUrl,
  availableWallets,
  onConnect,
  onDisconnect,
}: AptosWalletButtonProps) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [animateIn, setAnimateIn] = useState(false);
  const [renderModal, setRenderModal] = useState(false);
  const [balance, setBalance] = useState<BalanceState>({
    loading: false,
    value: null,
    error: null,
  });
  const [actionError, setActionError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const buttonLabel =
    connected && address
      ? truncateAddress(address, 8, 6)
      : t("aptos.walletButton.connect");

  useEffect(() => {
    if (open) {
      setRenderModal(true);
      const id = window.requestAnimationFrame(() => setAnimateIn(true));
      return () => window.cancelAnimationFrame(id);
    }
    setAnimateIn(false);
    setActionError(null);
    setBalance({ loading: false, value: null, error: null });
    setCopied(false);
    const timeout = window.setTimeout(() => setRenderModal(false), 180);
    return () => window.clearTimeout(timeout);
  }, [open]);

  useEffect(() => {
    if (!open || !connected || !restUrl || !address) {
      return;
    }
    let cancelled = false;
    setBalance({ loading: true, value: null, error: null });
    fetchAptBalance(restUrl, address)
      .then((value) => {
        if (!cancelled) {
          setBalance({ loading: false, value, error: null });
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setBalance({
            loading: false,
            value: null,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [open, connected, restUrl, address]);

  useEffect(() => {
    if (!open) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open]);

  useEffect(() => {
    if (!copied) return;
    const timeout = window.setTimeout(() => setCopied(false), 1500);
    return () => window.clearTimeout(timeout);
  }, [copied]);

  const balanceText = useMemo(() => {
    if (balance.loading) return t("aptos.walletButton.balanceLoading");
    if (balance.error) return t("aptos.walletButton.balanceError");
    if (balance.value) return formatApt(balance.value);
    return "—";
  }, [balance, t]);

  const handleCopyAddress = async () => {
    if (!address) return;
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : String(error));
    }
  };

  const handleConnectWallet = async (walletToConnect: string) => {
    setActionError(null);
    try {
      await onConnect(walletToConnect);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : String(error));
    }
  };

  const handleDisconnectWallet = async () => {
    setActionError(null);
    try {
      await onDisconnect();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : String(error));
    }
  };

  const openModal = () => {
    setOpen(true);
  };

  const closeModal = () => {
    setAnimateIn(false);
    setTimeout(() => setOpen(false), 180);
  };

  return (
    <Fragment>
      <button
        type="button"
        onClick={openModal}
        className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition ${
          connected
            ? "border-sky-500/60 bg-sky-500/15 text-sky-200 hover:border-sky-400 hover:text-sky-100"
            : "border-slate-700 bg-slate-900/70 text-slate-300 hover:border-sky-500 hover:text-sky-100"
        }`}
      >
        <span
          className="inline-block h-2 w-2 rounded-full"
          style={{ backgroundColor: connected ? "#38bdf8" : "#64748b" }}
        />
        <span>{buttonLabel}</span>
      </button>

      {renderModal ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm"
          onClick={closeModal}
        >
          <div
            className={`relative w-full max-w-lg transform rounded-2xl border border-slate-800 bg-slate-950 p-6 text-slate-100 shadow-2xl transition-all duration-200 ${
              animateIn
                ? "opacity-100 scale-100 translate-y-0"
                : "opacity-0 scale-95 -translate-y-2"
            }`}
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              onClick={closeModal}
              className="absolute right-4 top-4 rounded-full border border-slate-700 p-1 text-slate-400 transition hover:border-slate-500 hover:text-slate-200"
            >
              ✕
            </button>

            <div className="space-y-6">
              <header className="space-y-1">
                <h2 className="text-lg font-semibold">
                  {t("aptos.walletButton.modalTitle")}
                </h2>
                <p className="text-sm text-slate-400">
                  {connected && walletName
                    ? t("aptos.signing.connectedSummary", {
                        wallet: walletName,
                      })
                    : t("aptos.signing.notConnectedSummary")}
                </p>
              </header>

              <section className="space-y-4 rounded-xl border border-slate-800 bg-slate-900/40 p-4">
                <div className="space-y-3 text-sm text-slate-300">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">
                      {t("aptos.walletButton.walletName")}
                    </span>
                    <span className="rounded-md bg-slate-900/70 px-3 py-1 text-xs text-slate-200">
                      {walletName ?? "—"}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500">
                      {t("aptos.walletButton.address")}
                    </span>
                    <div className="mt-1 flex items-center justify-between gap-3 rounded-md border border-slate-800 bg-slate-900/70 px-3 py-2 text-xs">
                      <span className="truncate text-slate-200">
                        {address || "—"}
                      </span>
                      <button
                        type="button"
                        onClick={handleCopyAddress}
                        className="rounded-md border border-slate-700 px-2 py-1 text-[11px] text-slate-300 transition hover:border-slate-500 hover:text-slate-100"
                      >
                        {copied
                          ? t("aptos.walletButton.copied")
                          : t("aptos.walletButton.copyAddress")}
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">
                      {t("aptos.walletButton.network")}
                    </span>
                    <span className="rounded-md bg-slate-900/70 px-3 py-1 text-xs text-slate-200">
                      {networkLabel}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">
                      {t("aptos.walletButton.balance")}
                    </span>
                    <span className="rounded-md bg-slate-900/70 px-3 py-1 text-xs text-slate-200">
                      {balanceText}
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={handleDisconnectWallet}
                    disabled={!connected}
                    className="rounded-lg border border-rose-500/60 px-3 py-2 text-xs font-medium text-rose-200 transition hover:border-rose-400 disabled:cursor-not-allowed disabled:border-slate-700 disabled:text-slate-500"
                  >
                    {t("aptos.walletButton.disconnect")}
                  </button>
                </div>
              </section>

              <section className="space-y-3 rounded-xl border border-slate-800 bg-slate-900/40 p-4">
                <h3 className="text-sm font-semibold text-slate-200">
                  {t("aptos.walletButton.availableWallets")}
                </h3>
                {availableWallets.length > 0 ? (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {availableWallets.map((item) => {
                      const isCurrent = connected && walletName === item.name;
                      return (
                        <button
                          key={item.name}
                          type="button"
                          onClick={() => {
                            if (!isCurrent) handleConnectWallet(item.name);
                          }}
                          disabled={isCurrent}
                          className={`flex flex-col items-start gap-1 rounded-lg border px-4 py-3 text-left text-xs transition duration-200 disabled:cursor-not-allowed ${
                            isCurrent
                              ? "border-sky-500/60 bg-sky-500/10 text-sky-100"
                              : "border-slate-800 bg-slate-900/70 text-slate-300 hover:-translate-y-0.5 hover:border-sky-500/70 hover:text-sky-200 hover:shadow-sky-500/20"
                          }`}
                        >
                          <span className="text-sm font-medium text-slate-100">
                            {item.name}
                          </span>
                          <span className="text-xs text-slate-500">
                            {t("aptos.walletButton.statusLabel", {
                              status: item.readyState,
                            })}
                          </span>
                          <span
                            className={`mt-1 text-xs font-medium ${
                              isCurrent ? "text-sky-200" : "text-sky-300"
                            }`}
                          >
                            {isCurrent
                              ? t("aptos.walletButton.currentWallet")
                              : t("aptos.walletButton.connectAction")}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500">
                    {t("aptos.walletButton.noWallets")}
                  </p>
                )}
              </section>

              {actionError ? (
                <p className="text-xs text-rose-400">{actionError}</p>
              ) : null}

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={closeModal}
                  className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-medium text-slate-300 transition hover:border-slate-500 hover:text-slate-100"
                >
                  {t("aptos.walletButton.close")}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </Fragment>
  );
}
