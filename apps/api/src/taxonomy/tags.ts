/**
 * current ∪ add, minus `remove` — order-stable, de-duplicated. Used wherever we
 * write a document's tag array: merge the AI's tags with the existing ones and
 * drop the trigger tags in the same PATCH, never a blind overwrite.
 */
export function mergeTagIds(current: number[], add: number[], remove: number[]): number[] {
  const removeSet = new Set(remove);
  const result = new Set(current.filter((id) => !removeSet.has(id)));
  // Apply `remove` to the union, not just to `current`: a suggested tag whose
  // name collides with a trigger tag (e.g. "ai-process") must not survive the
  // very PATCH meant to drop it.
  for (const id of add) if (!removeSet.has(id)) result.add(id);
  return [...result];
}
