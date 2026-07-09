/** Coerce MySQL decimal / unknown values to a finite number. */
export function toAmount(value: unknown): number {
  if (value == null || value === '') {
    return 0;
  }

  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}
