import { describe, expect, it } from 'vitest';
import { createTestDb } from '../../test/db';
import { auditLog } from '../db/schema';
import { AuditService } from './audit.service';

describe('AuditService', () => {
  it('lists newest-first, flags detail rows, and paginates', () => {
    const svc = new AuditService(createTestDb());
    svc.record({ documentId: 1, decision: 'skipped' });
    svc.record({ documentId: 2, decision: 'auto-applied', prompt: 'P2', rawOutput: '{"title":"a"}', tokensCost: 10 });
    svc.record({ documentId: 3, decision: 'review-queued', prompt: 'P3', rawOutput: '{"title":"b"}', tokensCost: 20 });

    const page = svc.list({ limit: 2, offset: 0 });
    expect(page.total).toBe(3);
    expect(page.items.map((i) => i.documentId)).toEqual([3, 2]);
    expect(page.items[0].hasDetail).toBe(true);
    expect(page.items[0].tokensCost).toBe(20);

    const next = svc.list({ limit: 2, offset: 2 });
    expect(next.items.map((i) => i.documentId)).toEqual([1]);
    expect(next.items[0].hasDetail).toBe(false);
  });

  it('filters by documentId and decision', () => {
    const svc = new AuditService(createTestDb());
    svc.record({ documentId: 1, decision: 'skipped' });
    svc.record({ documentId: 1, decision: 'auto-applied', prompt: 'x' });
    svc.record({ documentId: 2, decision: 'auto-applied', prompt: 'y' });

    expect(svc.list({ documentId: 1, limit: 50, offset: 0 }).total).toBe(2);
    expect(svc.list({ decision: 'auto-applied', limit: 50, offset: 0 }).total).toBe(2);
    expect(svc.list({ documentId: 1, decision: 'auto-applied', limit: 50, offset: 0 }).total).toBe(1);
  });

  it('text-searches the prompt and the raw output, case-insensitively', () => {
    const svc = new AuditService(createTestDb());
    svc.record({ documentId: 1, decision: 'auto-applied', prompt: 'Invoice from ACME', rawOutput: '{}' });
    svc.record({ documentId: 2, decision: 'auto-applied', prompt: 'Receipt', rawOutput: '{"correspondent":"acme"}' });
    svc.record({ documentId: 3, decision: 'auto-applied', prompt: 'unrelated', rawOutput: '{}' });

    // matches doc 1 via its prompt and doc 2 via its output
    expect(svc.list({ q: 'acme', limit: 50, offset: 0 }).total).toBe(2);
    expect(svc.list({ q: 'nothing-here', limit: 50, offset: 0 }).total).toBe(0);
  });

  it('treats LIKE wildcards in the query as literal characters', () => {
    const svc = new AuditService(createTestDb());
    svc.record({ documentId: 1, decision: 'auto-applied', prompt: 'discount 50% applied', rawOutput: '{}' });
    svc.record({ documentId: 2, decision: 'auto-applied', prompt: 'discount 5000 applied', rawOutput: '{}' });

    // '50%' must match the literal "50%", not "50<anything>" (which would also hit "5000")
    const res = svc.list({ q: '50%', limit: 50, offset: 0 });
    expect(res.total).toBe(1);
    expect(res.items[0].documentId).toBe(1);
  });

  it('returns full detail by id, and null for a missing id', () => {
    const db = createTestDb();
    const svc = new AuditService(db);
    svc.record({
      documentId: 5,
      jobId: 9,
      decision: 'auto-applied',
      prompt: 'PROMPT',
      rawOutput: '{"title":"t"}',
      result: { title: 't' },
      tokensCost: 42,
    });
    const id = db.select().from(auditLog).all()[0].id;

    const detail = svc.get(id);
    expect(detail).not.toBeNull();
    expect(detail!.prompt).toBe('PROMPT');
    expect(detail!.rawOutput).toBe('{"title":"t"}');
    expect(detail!.result).toEqual({ title: 't' });
    expect(detail!.tokensCost).toBe(42);
    expect(detail!.jobId).toBe(9);
    expect(detail!.hasDetail).toBe(true);

    expect(svc.get(99_999)).toBeNull();
  });
});
