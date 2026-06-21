import { describe, expect, it } from 'vitest';
import { mergeTagIds } from './tags';

describe('mergeTagIds', () => {
  it('unions current + add, de-duplicated and order-stable', () => {
    expect(mergeTagIds([1, 2], [2, 3], [])).toEqual([1, 2, 3]);
  });

  it('removes the trigger tags from current', () => {
    expect(mergeTagIds([9, 100], [7], [100, 101])).toEqual([9, 7]);
  });

  it('does NOT re-add an added id that is also in remove (trigger-tag collision)', () => {
    // The LLM suggested a tag whose name resolved to the trigger id 100.
    expect(mergeTagIds([9, 100], [100, 7], [100, 101])).toEqual([9, 7]);
  });
});
