import type { ExecutionSnapshot, SnapshotSummary } from '../types';

export interface ISnapshotStore {
  save(snapshot: ExecutionSnapshot): Promise<void>;
  get(traceId: string): Promise<ExecutionSnapshot | null>;
  list(options?: { limit?: number }): Promise<SnapshotSummary[]>;
  getLatest(): Promise<ExecutionSnapshot | null>;

  /** Load in-progress partial snapshot */
  loadPartial(operationId: string): Promise<Partial<ExecutionSnapshot> | null>;
  /** Save in-progress partial snapshot */
  savePartial(operationId: string, partial: Partial<ExecutionSnapshot>): Promise<void>;
  /** Remove partial snapshot (after finalizing) */
  removePartial(operationId: string): Promise<void>;
}
