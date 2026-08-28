export function reconcileEmailSelection(
  records: ReadonlyArray<{ id: string }>,
  selectedId: string | null,
): string | null {
  if (selectedId && records.some(record => record.id === selectedId)) {
    return selectedId;
  }
  return records[0]?.id || null;
}
