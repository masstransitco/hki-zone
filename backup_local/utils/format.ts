export const PRICE_CAP = 20_000_000;

export function formatHKD(n: number): string {
  if (n >= 1_000_000_000) return `HK$${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000)     return `HK$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000)         return `HK$${(n / 1_000).toFixed(0)}K`;
  return `HK$${n}`;
}

export function deriveEstateLabel(row: any): string {
  return row.estate_display ?? row.estate_name ?? '(Unknown Estate)';
}

export function derivePrice(row: any): { num: number | null; label: string } {
  const num = row.price_display_num ?? row.price_hkd_src ?? row.price_hkd ?? null;
  if (num != null && num > 0 && num <= PRICE_CAP) {
    return { num, label: formatHKD(num) };
  }
  return { num: null, label: 'Call' };
}

export const DISTRICT_LABELS: Record<string, string> = {
  HKI: 'Hong Kong Island',
  KOWLOON: 'Kowloon',
  NT: 'New Territories',
};

export function districtLabel(code?: string | null): string {
  if (!code) return '';
  return DISTRICT_LABELS[code] ?? code;
}