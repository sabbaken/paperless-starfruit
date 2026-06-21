import { describe, expect, it, vi } from 'vitest';
import type { ConnectionService } from '../connection/connection.service';
import type { SettingsService } from '../settings/settings.service';
import type { TaxonomyService } from '../taxonomy/taxonomy.service';
import type { ReviewService } from '../review/review.service';
import type { QueueService } from '../queue/queue.service';
import { PollerService } from './poller.service';

interface Fakes {
  client: { listDocuments: ReturnType<typeof vi.fn> } | null;
  hasPending?: (id: number) => boolean;
  hasTerminalFailure?: (id: number) => boolean;
  enqueue?: (id: number) => boolean;
}

function makePoller({
  client,
  hasPending = () => false,
  hasTerminalFailure = () => false,
  enqueue = () => true,
}: Fakes) {
  const connection = { getClient: () => client } as unknown as ConnectionService;
  const settings = { get: () => ({ pollIntervalSec: 60 }) } as unknown as SettingsService;
  const taxonomy = {
    resolveTriggerTags: vi.fn().mockResolvedValue({ reviewTagId: 100, autoTagId: 101 }),
  } as unknown as TaxonomyService;
  const review = { hasPending: vi.fn(hasPending) } as unknown as ReviewService;
  const enqueueMock = vi.fn(enqueue);
  const queue = {
    enqueue: enqueueMock,
    hasTerminalFailure: vi.fn(hasTerminalFailure),
  } as unknown as QueueService;
  return { poller: new PollerService(connection, settings, taxonomy, review, queue), enqueueMock };
}

const docs = (ids: number[]) => ({
  listDocuments: vi.fn().mockResolvedValue({ count: ids.length, results: ids.map((id) => ({ id })) }),
});

describe('PollerService.pollOnce', () => {
  it('does nothing when no connection is configured', async () => {
    const { poller, enqueueMock } = makePoller({ client: null });
    expect(await poller.pollOnce()).toBe(0);
    expect(enqueueMock).not.toHaveBeenCalled();
  });

  it('enqueues every freshly-tagged document', async () => {
    const client = docs([1, 2, 3]);
    const { poller, enqueueMock } = makePoller({ client });
    expect(await poller.pollOnce()).toBe(3);
    expect(enqueueMock).toHaveBeenCalledTimes(3);
    // queried by both trigger tag ids
    expect(client.listDocuments).toHaveBeenCalledWith({ tagIds: [100, 101], ordering: 'added' });
  });

  it('skips documents already awaiting review', async () => {
    const { poller, enqueueMock } = makePoller({
      client: docs([1, 2]),
      hasPending: (id) => id === 2,
    });
    expect(await poller.pollOnce()).toBe(1);
    expect(enqueueMock).toHaveBeenCalledTimes(1);
    expect(enqueueMock).toHaveBeenCalledWith(1);
  });

  it('skips documents with a terminal failed job (no re-poll churn)', async () => {
    const { poller, enqueueMock } = makePoller({
      client: docs([1, 2]),
      hasTerminalFailure: (id) => id === 2,
    });
    expect(await poller.pollOnce()).toBe(1);
    expect(enqueueMock).toHaveBeenCalledTimes(1);
    expect(enqueueMock).toHaveBeenCalledWith(1);
  });

  it('does not double-count documents that already have an active job', async () => {
    const { poller } = makePoller({
      client: docs([1, 2, 3]),
      enqueue: (id) => id !== 2, // 2 already active
    });
    expect(await poller.pollOnce()).toBe(2);
  });
});
