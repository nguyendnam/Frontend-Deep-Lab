export function getPage(value: string | string[] | undefined, totalPages: number) {
  const number = typeof value === "string" ? Number(value) : 1;
  if (!Number.isSafeInteger(number) || number < 1) return 1;
  return Math.min(number, Math.max(1, totalPages));
}
