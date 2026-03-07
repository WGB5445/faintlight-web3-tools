import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useLanguage } from "../context/LanguageContext";
import { useAptosSettings } from "../context/AptosSettingsContext";
import { APTOS_NETWORKS } from "../lib/networks";
import { GasScheduleLookup } from "../lib/gasSchedule";

type SortField = "key" | "value";
type SortOrder = "asc" | "desc";
type FilterType = "all" | "instr" | "txn" | "other";

export default function GasScheduleToolPage() {
  const { t } = useLanguage();
  const {
    networkId,
    setNetworkId,
    customEndpoint,
    setCustomEndpoint,
    restEndpoint,
  } = useAptosSettings();
  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [entries, setEntries] = useState<Array<{ key: string; value: number }>>(
    [],
  );
  const [featureVersion, setFeatureVersion] = useState<number | null>(null);
  const [scalingFactor, setScalingFactor] = useState<number | null>(null);

  // 从 URL 参数初始化状态
  const [searchPattern, setSearchPattern] = useState(
    () => searchParams.get("search") || "",
  );
  const [filterType, setFilterType] = useState<FilterType>(() => {
    const filter = searchParams.get("filter") as FilterType;
    return filter && ["all", "instr", "txn", "other"].includes(filter)
      ? filter
      : "all";
  });
  const [sortField, setSortField] = useState<SortField>(() => {
    const sort = searchParams.get("sortField") as SortField;
    return sort && ["key", "value"].includes(sort) ? sort : "key";
  });
  const [sortOrder, setSortOrder] = useState<SortOrder>(() => {
    const order = searchParams.get("sortOrder") as SortOrder;
    return order && ["asc", "desc"].includes(order) ? order : "asc";
  });
  const [showExternalGas, setShowExternalGas] = useState(() => {
    return searchParams.get("showExternal") === "true";
  });
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const lastLoadedEndpoint = useRef<string | null>(null);
  const hasInitialLoad = useRef(false);
  const isInitializingFromUrl = useRef(true);
  const urlInitialized = useRef(false);

  // 从 URL 参数初始化网络设置（仅在首次加载时）
  useEffect(() => {
    if (!urlInitialized.current) {
      const urlNetwork = searchParams.get("network");
      const urlCustomEndpoint = searchParams.get("customEndpoint");

      if (
        urlNetwork &&
        ["mainnet", "testnet", "devnet", "custom"].includes(urlNetwork)
      ) {
        setNetworkId(urlNetwork as "mainnet" | "testnet" | "devnet" | "custom");
        if (urlNetwork === "custom" && urlCustomEndpoint) {
          setCustomEndpoint(urlCustomEndpoint);
        }
      }
      urlInitialized.current = true;
      // 标记初始化完成，允许后续的 URL 更新
      isInitializingFromUrl.current = false;
    }
  }, [searchParams, setNetworkId, setCustomEndpoint]);

  // 更新 URL 参数
  const updateSearchParams = useCallback(
    (updates: Record<string, string | null>) => {
      if (isInitializingFromUrl.current) return;

      setSearchParams((prev) => {
        const newParams = new URLSearchParams(prev);
        Object.entries(updates).forEach(([key, value]) => {
          if (
            value === null ||
            value === "" ||
            value === "all" ||
            value === "false"
          ) {
            newParams.delete(key);
          } else {
            newParams.set(key, value);
          }
        });
        return newParams;
      });
    },
    [setSearchParams],
  );

  // 同步状态到 URL（排除初始化阶段）
  useEffect(() => {
    if (isInitializingFromUrl.current) return;

    updateSearchParams({
      search: searchPattern || null,
      filter: filterType !== "all" ? filterType : null,
      sortField: sortField !== "key" ? sortField : null,
      sortOrder: sortOrder !== "asc" ? sortOrder : null,
      showExternal: showExternalGas ? "true" : null,
      network: networkId !== "testnet" ? networkId : null,
      customEndpoint:
        networkId === "custom" && customEndpoint ? customEndpoint : null,
    });
  }, [
    searchPattern,
    filterType,
    sortField,
    sortOrder,
    showExternalGas,
    networkId,
    customEndpoint,
    updateSearchParams,
  ]);

  const loadGasSchedule = useCallback(async () => {
    if (!restEndpoint) {
      setError(t("gasSchedule.errors.missingEndpoint"));
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const lookup = new GasScheduleLookup({ nodeUrl: restEndpoint });
      const allEntries = await lookup.getAllEntries();
      const version = await lookup.getFeatureVersion();
      const factor = await lookup.getScalingFactor();

      setEntries(allEntries);
      setFeatureVersion(version);
      setScalingFactor(factor);
      lastLoadedEndpoint.current = restEndpoint;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(t("gasSchedule.errors.loadError", { message }));
      setEntries([]);
      setFeatureVersion(null);
      setScalingFactor(null);
    } finally {
      setLoading(false);
    }
  }, [restEndpoint, t]);

  // 自动加载：首次挂载和 restEndpoint 变化时自动加载
  useEffect(() => {
    if (restEndpoint) {
      // 首次加载或 endpoint 变化时加载
      if (
        !hasInitialLoad.current ||
        restEndpoint !== lastLoadedEndpoint.current
      ) {
        hasInitialLoad.current = true;
        loadGasSchedule();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restEndpoint]); // 只依赖 restEndpoint，loadGasSchedule 已经在内部处理了依赖

  const copyToClipboard = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const filteredAndSortedEntries = useMemo(() => {
    let filtered = [...entries];

    // 应用搜索过滤
    if (searchPattern.trim()) {
      const pattern = searchPattern.toLowerCase();
      filtered = filtered.filter((entry) =>
        entry.key.toLowerCase().includes(pattern),
      );
    }

    // 应用类型过滤
    if (filterType !== "all") {
      filtered = filtered.filter((entry) => {
        if (filterType === "instr") return entry.key.startsWith("instr.");
        if (filterType === "txn") return entry.key.startsWith("txn.");
        if (filterType === "other") {
          return (
            !entry.key.startsWith("instr.") && !entry.key.startsWith("txn.")
          );
        }
        return true;
      });
    }

    // 应用排序
    filtered.sort((a, b) => {
      let comparison = 0;
      if (sortField === "key") {
        comparison = a.key.localeCompare(b.key);
      } else {
        comparison = a.value - b.value;
      }
      return sortOrder === "asc" ? comparison : -comparison;
    });

    return filtered;
  }, [entries, searchPattern, filterType, sortField, sortOrder]);

  const statistics = useMemo(() => {
    const instrCount = entries.filter((e) => e.key.startsWith("instr.")).length;
    const txnCount = entries.filter((e) => e.key.startsWith("txn.")).length;
    const otherCount = entries.length - instrCount - txnCount;
    const minValue =
      entries.length > 0 ? Math.min(...entries.map((e) => e.value)) : 0;
    const maxValue =
      entries.length > 0 ? Math.max(...entries.map((e) => e.value)) : 0;
    const avgValue =
      entries.length > 0
        ? Math.floor(
            entries.reduce((sum, e) => sum + e.value, 0) / entries.length,
          )
        : 0;

    return {
      total: entries.length,
      instr: instrCount,
      txn: txnCount,
      other: otherCount,
      min: minValue,
      max: maxValue,
      avg: avgValue,
    };
  }, [entries]);

  const formatValue = (value: number) => {
    if (showExternalGas && scalingFactor) {
      const external = GasScheduleLookup.internalToExternal(
        value,
        scalingFactor,
      );
      // 格式化外部 Gas 单位，保留足够的小数位，但去掉末尾的0
      const externalFormatted = external.toFixed(6).replace(/\.?0+$/, "");
      return `${value.toLocaleString()} (${externalFormatted} external)`;
    }
    return value.toLocaleString();
  };

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">
          {t("gasSchedule.title")}
        </h1>
        <p className="text-slate-300">{t("gasSchedule.description")}</p>
      </header>

      <section className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="flex flex-col gap-2 text-sm font-medium text-slate-200">
            {t("aptos.network.label")}
            <select
              className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100"
              value={networkId}
              onChange={(event) => {
                const nextNetwork = event.target.value as
                  | "mainnet"
                  | "testnet"
                  | "devnet"
                  | "custom";
                setNetworkId(nextNetwork);
              }}
            >
              {APTOS_NETWORKS.map((network) => (
                <option key={network.id} value={network.id}>
                  {network.label}
                </option>
              ))}
              <option value="custom">{t("aptos.network.customOption")}</option>
            </select>
          </label>

          {networkId === "custom" ? (
            <label className="flex flex-col gap-2 text-sm font-medium text-slate-200">
              {t("aptos.network.customLabel")}
              <input
                className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100"
                placeholder={t("aptos.network.customPlaceholder")}
                value={customEndpoint}
                onChange={(event) => setCustomEndpoint(event.target.value)}
              />
            </label>
          ) : (
            <div className="flex flex-col gap-2 text-sm text-slate-400">
              <span className="font-medium text-slate-300">
                {t("aptos.network.restLabel")}
              </span>
              <span className="truncate rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-xs">
                {restEndpoint}
              </span>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={loadGasSchedule}
          className="w-full rounded-lg bg-sky-500 px-4 py-2 text-sm font-medium text-slate-950 transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
          disabled={loading}
        >
          {loading
            ? t("gasSchedule.actions.loading")
            : t("gasSchedule.actions.reload")}
        </button>

        {error ? <p className="text-sm text-rose-400">{error}</p> : null}
      </section>

      {entries.length > 0 && (
        <section className="space-y-6">
          {/* Statistics */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6">
            <h2 className="text-xl font-semibold text-slate-100 mb-4">
              {t("gasSchedule.statistics.title")}
            </h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <div>
                <h3 className="text-sm font-medium text-slate-300 mb-2">
                  {t("gasSchedule.statistics.featureVersion")}
                </h3>
                <p className="text-lg font-mono text-slate-100">
                  {featureVersion ?? "N/A"}
                </p>
              </div>
              <div>
                <h3 className="text-sm font-medium text-slate-300 mb-2">
                  {t("gasSchedule.statistics.scalingFactor")}
                </h3>
                <p className="text-lg font-mono text-slate-100">
                  {scalingFactor ? scalingFactor.toLocaleString() : "N/A"}
                </p>
              </div>
              <div>
                <h3 className="text-sm font-medium text-slate-300 mb-2">
                  {t("gasSchedule.statistics.totalEntries")}
                </h3>
                <p className="text-lg font-mono text-slate-100">
                  {statistics.total}
                </p>
              </div>
              <div>
                <h3 className="text-sm font-medium text-slate-300 mb-2">
                  {t("gasSchedule.statistics.filteredEntries")}
                </h3>
                <p className="text-lg font-mono text-slate-100">
                  {filteredAndSortedEntries.length}
                </p>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-slate-700 grid gap-4 md:grid-cols-3">
              <div>
                <h3 className="text-sm font-medium text-slate-300 mb-2">
                  {t("gasSchedule.statistics.byType")}
                </h3>
                <div className="space-y-1 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-blue-400"></span>
                    <span className="text-slate-400">instr.*:</span>
                    <span className="text-slate-200 font-mono">
                      {statistics.instr}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-green-400"></span>
                    <span className="text-slate-400">txn.*:</span>
                    <span className="text-slate-200 font-mono">
                      {statistics.txn}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-purple-400"></span>
                    <span className="text-slate-400">
                      {t("gasSchedule.statistics.other")}:
                    </span>
                    <span className="text-slate-200 font-mono">
                      {statistics.other}
                    </span>
                  </div>
                </div>
              </div>
              <div>
                <h3 className="text-sm font-medium text-slate-300 mb-2">
                  {t("gasSchedule.statistics.valueRange")}
                </h3>
                <div className="space-y-1 text-sm">
                  <div className="text-slate-400">
                    {t("gasSchedule.statistics.min")}:{" "}
                    <span className="text-slate-200 font-mono">
                      {statistics.min.toLocaleString()}
                    </span>
                  </div>
                  <div className="text-slate-400">
                    {t("gasSchedule.statistics.max")}:{" "}
                    <span className="text-slate-200 font-mono">
                      {statistics.max.toLocaleString()}
                    </span>
                  </div>
                  <div className="text-slate-400">
                    {t("gasSchedule.statistics.avg")}:{" "}
                    <span className="text-slate-200 font-mono">
                      {statistics.avg.toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Filters and Sort */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 space-y-4">
            <h2 className="text-xl font-semibold text-slate-100">
              {t("gasSchedule.filters.title")}
            </h2>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="flex flex-col gap-2 text-sm font-medium text-slate-200">
                {t("gasSchedule.filters.search")}
                <input
                  type="text"
                  className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100"
                  placeholder={t("gasSchedule.filters.searchPlaceholder")}
                  value={searchPattern}
                  onChange={(event) => setSearchPattern(event.target.value)}
                />
              </label>

              <label className="flex flex-col gap-2 text-sm font-medium text-slate-200">
                {t("gasSchedule.filters.type")}
                <select
                  className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100"
                  value={filterType}
                  onChange={(event) =>
                    setFilterType(event.target.value as FilterType)
                  }
                >
                  <option value="all">
                    {t("gasSchedule.filters.typeAll")}
                  </option>
                  <option value="instr">
                    {t("gasSchedule.filters.typeInstr")}
                  </option>
                  <option value="txn">
                    {t("gasSchedule.filters.typeTxn")}
                  </option>
                  <option value="other">
                    {t("gasSchedule.filters.typeOther")}
                  </option>
                </select>
              </label>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="flex flex-col gap-2 text-sm font-medium text-slate-200">
                {t("gasSchedule.filters.sortBy")}
                <select
                  className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100"
                  value={sortField}
                  onChange={(event) =>
                    setSortField(event.target.value as SortField)
                  }
                >
                  <option value="key">
                    {t("gasSchedule.filters.sortKey")}
                  </option>
                  <option value="value">
                    {t("gasSchedule.filters.sortValue")}
                  </option>
                </select>
              </label>

              <label className="flex flex-col gap-2 text-sm font-medium text-slate-200">
                {t("gasSchedule.filters.sortOrder")}
                <select
                  className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100"
                  value={sortOrder}
                  onChange={(event) =>
                    setSortOrder(event.target.value as SortOrder)
                  }
                >
                  <option value="asc">
                    {t("gasSchedule.filters.sortAsc")}
                  </option>
                  <option value="desc">
                    {t("gasSchedule.filters.sortDesc")}
                  </option>
                </select>
              </label>
            </div>

            <label className="flex items-center gap-3 text-sm text-slate-200">
              <input
                type="checkbox"
                checked={showExternalGas}
                onChange={(event) => setShowExternalGas(event.target.checked)}
                className="h-4 w-4 rounded border-slate-700 bg-slate-900"
              />
              <span>{t("gasSchedule.filters.showExternalGas")}</span>
            </label>
          </div>

          {/* Entries Table */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 overflow-hidden">
            <div className="p-4 border-b border-slate-700 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-slate-100">
                {t("gasSchedule.entries.title")} (
                {filteredAndSortedEntries.length})
              </h2>
              <button
                onClick={() => {
                  const allKeys = filteredAndSortedEntries
                    .map((e) => e.key)
                    .join("\n");
                  copyToClipboard(allKeys, "all-keys");
                }}
                className="px-3 py-1 text-xs font-medium bg-slate-700 hover:bg-slate-600 text-slate-300 rounded transition-colors"
              >
                {copiedId === "all-keys"
                  ? t("gasSchedule.actions.copied")
                  : t("gasSchedule.actions.copyAllKeys")}
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-800/50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">
                      {t("gasSchedule.entries.key")}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">
                      {t("gasSchedule.entries.value")}
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-slate-300 uppercase tracking-wider w-24">
                      {t("gasSchedule.entries.actions")}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700">
                  {filteredAndSortedEntries.map((entry, index) => {
                    const entryId = `entry-${index}`;
                    const isInstr = entry.key.startsWith("instr.");
                    const isTxn = entry.key.startsWith("txn.");
                    return (
                      <tr
                        key={entry.key}
                        className="hover:bg-slate-800/30 transition-colors"
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            {isInstr && (
                              <span className="px-2 py-0.5 rounded text-xs font-medium bg-blue-500/20 text-blue-300 border border-blue-500/30">
                                instr
                              </span>
                            )}
                            {isTxn && (
                              <span className="px-2 py-0.5 rounded text-xs font-medium bg-green-500/20 text-green-300 border border-green-500/30">
                                txn
                              </span>
                            )}
                            <span className="text-sm font-mono text-slate-200">
                              {entry.key}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm font-mono text-slate-300">
                            {formatValue(entry.value)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => copyToClipboard(entry.key, entryId)}
                            className="px-2 py-1 text-xs font-medium bg-slate-700 hover:bg-slate-600 text-slate-300 rounded transition-colors"
                          >
                            {copiedId === entryId
                              ? t("gasSchedule.actions.copied")
                              : t("gasSchedule.actions.copy")}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {filteredAndSortedEntries.length === 0 && (
                <div className="p-8 text-center text-slate-400">
                  {t("gasSchedule.entries.empty")}
                </div>
              )}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
