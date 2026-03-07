export interface GasEntry {
  key: string;
  val: string;
}

export interface GasScheduleV2Data {
  feature_version: string;
  entries: GasEntry[];
}

export interface GasScheduleV2Response {
  type: string;
  data: GasScheduleV2Data;
}

export interface GasScheduleLookupOptions {
  nodeUrl?: string;
  cacheTimeout?: number; // 缓存超时时间（毫秒），默认 60 分钟
}

export class GasScheduleLookup {
  private nodeUrl: string;
  private cacheTimeout: number;
  private cache: GasScheduleV2Response | null = null;
  private cacheTime: number = 0;
  private entries: Map<string, number> = new Map();

  constructor(options: GasScheduleLookupOptions = {}) {
    this.nodeUrl = options.nodeUrl || "https://fullnode.mainnet.aptoslabs.com";
    this.cacheTimeout = options.cacheTimeout || 60 * 60 * 1000; // 默认 60 分钟
  }

  /**
   * 从链上获取 GasScheduleV2
   */
  async fetchGasSchedule(): Promise<GasScheduleV2Response> {
    const now = Date.now();

    // 检查缓存是否有效
    if (this.cache && now - this.cacheTime < this.cacheTimeout) {
      return this.cache;
    }

    try {
      // Ensure nodeUrl doesn't have trailing slash and doesn't already include /v1
      const baseUrl = this.nodeUrl.replace(/\/$/, "");
      const resourceType = "0x1::gas_schedule::GasScheduleV2";
      const encodedResourceType = encodeURIComponent(resourceType);

      // Check if baseUrl already contains /v1, if not add it
      const apiBase = baseUrl.includes("/v1") ? baseUrl : `${baseUrl}/v1`;
      const url = `${apiBase}/accounts/0x1/resource/${encodedResourceType}`;

      const response = await fetch(url);

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error(
            `GasScheduleV2 resource not found. This resource may not be available on the selected network (${this.nodeUrl}). Try switching to mainnet.`,
          );
        }
        throw new Error(
          `Failed to fetch GasScheduleV2: ${response.status} ${response.statusText}`,
        );
      }

      const data: GasScheduleV2Response = await response.json();

      // 更新缓存
      this.cache = data;
      this.cacheTime = now;

      // 构建 entries map
      this.entries.clear();
      for (const entry of data.data.entries) {
        this.entries.set(entry.key, parseInt(entry.val, 10));
      }

      return data;
    } catch (error) {
      throw new Error(
        `Error fetching GasScheduleV2: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * 获取 feature version
   */
  async getFeatureVersion(): Promise<number> {
    const data = await this.fetchGasSchedule();
    return parseInt(data.data.feature_version, 10);
  }

  /**
   * 查找特定 key 的 gas 值
   */
  async lookup(key: string): Promise<number | null> {
    await this.fetchGasSchedule();
    return this.entries.get(key) ?? null;
  }

  /**
   * 搜索包含 pattern 的所有 key
   */
  async search(pattern: string): Promise<Map<string, number>> {
    await this.fetchGasSchedule();
    const patternLower = pattern.toLowerCase();
    const results = new Map<string, number>();

    for (const [key, value] of this.entries.entries()) {
      if (key.toLowerCase().includes(patternLower)) {
        results.set(key, value);
      }
    }

    return results;
  }

  /**
   * 获取所有指令的 gas 成本
   */
  async getInstructionCosts(): Promise<Map<string, number>> {
    await this.fetchGasSchedule();
    const results = new Map<string, number>();

    for (const [key, value] of this.entries.entries()) {
      if (key.startsWith("instr.")) {
        results.set(key, value);
      }
    }

    return results;
  }

  /**
   * 获取所有交易相关的 gas 参数
   */
  async getTransactionParams(): Promise<Map<string, number>> {
    await this.fetchGasSchedule();
    const results = new Map<string, number>();

    for (const [key, value] of this.entries.entries()) {
      if (key.startsWith("txn.")) {
        results.set(key, value);
      }
    }

    return results;
  }

  /**
   * 获取所有限制参数（包含 max 或 min 的参数）
   */
  async getLimits(): Promise<Map<string, number>> {
    const params = await this.getTransactionParams();
    const results = new Map<string, number>();

    for (const [key, value] of params.entries()) {
      if (
        key.toLowerCase().includes("max") ||
        key.toLowerCase().includes("min")
      ) {
        results.set(key, value);
      }
    }

    return results;
  }

  /**
   * 将 InternalGas 转换为外部 Gas Units
   */
  static internalToExternal(
    internalGas: number,
    scalingFactor: number = 1_000_000,
  ): number {
    return internalGas / scalingFactor;
  }

  /**
   * 将外部 Gas Units 转换为 InternalGas
   */
  static externalToInternal(
    externalGas: number,
    scalingFactor: number = 1_000_000,
  ): number {
    return externalGas * scalingFactor;
  }

  /**
   * 获取 gas_unit_scaling_factor
   */
  async getScalingFactor(): Promise<number> {
    const factor = await this.lookup("txn.gas_unit_scaling_factor");
    return factor ?? 1_000_000;
  }

  /**
   * 查找指令的 gas 成本（简化方法）
   */
  async getInstructionCost(instruction: string): Promise<number | null> {
    const key = `instr.${instruction}`;
    return await this.lookup(key);
  }

  /**
   * 获取所有条目数量
   */
  async getTotalEntries(): Promise<number> {
    await this.fetchGasSchedule();
    return this.entries.size;
  }

  /**
   * 获取所有条目
   */
  async getAllEntries(): Promise<Array<{ key: string; value: number }>> {
    await this.fetchGasSchedule();
    return Array.from(this.entries.entries()).map(([key, value]) => ({
      key,
      value,
    }));
  }

  /**
   * 清除缓存
   */
  clearCache(): void {
    this.cache = null;
    this.cacheTime = 0;
    this.entries.clear();
  }
}

// 导出便捷函数
export async function lookupGasCost(
  key: string,
  options?: GasScheduleLookupOptions,
): Promise<number | null> {
  const lookup = new GasScheduleLookup(options);
  return await lookup.lookup(key);
}

export async function searchGasCosts(
  pattern: string,
  options?: GasScheduleLookupOptions,
): Promise<Map<string, number>> {
  const lookup = new GasScheduleLookup(options);
  return await lookup.search(pattern);
}

// 默认导出
export default GasScheduleLookup;
