import { describe, expect, it } from 'vitest';
import { createTestDb } from '../../test/db';
import { HiddenTagsService } from './hidden-tags.service';

describe('HiddenTagsService', () => {
  it('hides and shows tags by id', () => {
    const svc = new HiddenTagsService(createTestDb());
    expect(svc.ids()).toEqual(new Set());

    svc.set(1, true);
    svc.set(2, true);
    expect(svc.ids()).toEqual(new Set([1, 2]));

    svc.set(1, false);
    expect(svc.ids()).toEqual(new Set([2]));
  });

  it('treats repeated hides and shows as no-ops', () => {
    const svc = new HiddenTagsService(createTestDb());

    svc.set(1, true);
    svc.set(1, true);
    expect(svc.ids()).toEqual(new Set([1]));

    svc.set(1, false);
    svc.set(1, false);
    expect(svc.ids()).toEqual(new Set());

    // Showing a tag that was never hidden is a no-op, not an error.
    svc.set(99, false);
    expect(svc.ids()).toEqual(new Set());
  });
});
