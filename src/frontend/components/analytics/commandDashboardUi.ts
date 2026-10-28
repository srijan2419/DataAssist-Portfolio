import type { CommandStatus, SupportingRow } from '../../types';

export function statusClasses(status: CommandStatus): string {
  if (status === 'green') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (status === 'yellow') return 'border-amber-200 bg-amber-50 text-amber-700';
  return 'border-red-200 bg-red-50 text-red-700';
}

export function statusFill(status: CommandStatus): string {
  if (status === 'green') return '#16a34a';
  if (status === 'yellow') return '#d97706';
  return '#dc2626';
}

export function statusText(status: CommandStatus): string {
  if (status === 'green') return 'On target';
  if (status === 'yellow') return 'Watch';
  return 'Attention';
}

export function formatMetricValue(value: number | string, unit?: string): string {
  const text = typeof value === 'number' ? value.toLocaleString() : value;
  return unit ? `${text}${unit}` : text;
}

export function formatPercent(value: number | null): string {
  if (value === null) return 'N/A';
  return `${value.toLocaleString(undefined, { maximumFractionDigits: 1 })}%`;
}

export function sourceRowHeaders(rows: SupportingRow[]): string[] {
  const first = rows[0];
  return first ? Object.keys(first) : [];
}

export function sourceRowValue(value: SupportingRow[string]): string {
  if (value === null) return '-';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number') return value.toLocaleString();
  return value;
}
