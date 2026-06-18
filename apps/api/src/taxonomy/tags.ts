/**
 * current ∪ add, minus `remove` — order-stable, de-duplicated. Used wherever we
 * write a document's tag array: merge the AI's tags with the existing ones and
 * drop the trigger tags in the same PATCH, never a blind overwrite.
 */
export function mergeTagIds(current: number[], add: number[], remove: number[]): number[] {
  const removeSet = new Set(remove);
  const result = new Set(current.filter((id) => !removeSet.has(id)));
  for (const id of add) result.add(id);
  return [...result];
}
