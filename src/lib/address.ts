function ensurePrefixedLowercase(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return '';
  const withoutPrefix = trimmed.startsWith('0x') || trimmed.startsWith('0X') ? trimmed.slice(2) : trimmed;
  return `0x${withoutPrefix.toLowerCase()}`;
}

export function normalizeAddress(address: unknown): string {
  if (typeof address === 'string') {
    return ensurePrefixedLowercase(address);
  }
  if (address && typeof (address as { toString?: () => string }).toString === 'function') {
    return ensurePrefixedLowercase((address as { toString: () => string }).toString());
  }
  return '';
}

export function truncateAddress(address: unknown, leading = 6, trailing = 4): string {
  const normalized = normalizeAddress(address);
  if (!normalized) return '';
  if (normalized.length <= leading + trailing + 3) {
    return normalized;
  }
  return `${normalized.slice(0, leading)}...${normalized.slice(-trailing)}`;
}
