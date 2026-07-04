import { describe, expect, it } from 'vitest';
import { createTestDb } from '../../test/db';
import { TagCommentsService } from './tag-comments.service';

describe('TagCommentsService', () => {
  it('stores, overwrites and maps hints by tag id', () => {
    const svc = new TagCommentsService(createTestDb());

    svc.set(1, 'Bills we have to pay');
    svc.set(2, 'Anything from the tax office');
    expect(svc.map()).toEqual(
      new Map([
        [1, 'Bills we have to pay'],
        [2, 'Anything from the tax office'],
      ]),
    );

    svc.set(1, 'Incoming invoices only');
    expect(svc.map().get(1)).toBe('Incoming invoices only');
    expect(svc.get(1)).toBe('Incoming invoices only');
    expect(svc.get(404)).toBeNull();
  });

  it('trims hints and treats blank or null as "clear"', () => {
    const svc = new TagCommentsService(createTestDb());

    svc.set(1, '  padded  ');
    expect(svc.map().get(1)).toBe('padded');

    svc.set(1, '   ');
    expect(svc.map().has(1)).toBe(false);

    svc.set(2, 'keep');
    svc.set(2, null);
    expect(svc.map().has(2)).toBe(false);

    // Clearing a hint that never existed is a no-op, not an error.
    svc.set(99, null);
    expect(svc.map().size).toBe(0);
  });
});
