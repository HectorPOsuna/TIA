import type { SystemSnapshotDto } from '../domain/types.js';

export interface PersistenceRepository {
  load(): SystemSnapshotDto | null;
  save(snapshot: SystemSnapshotDto): void;
}

export class MemoryPersistence implements PersistenceRepository {
  private state: SystemSnapshotDto | null = null;

  load(): SystemSnapshotDto | null {
    return this.state;
  }

  save(snapshot: SystemSnapshotDto): void {
    this.state = snapshot;
  }
}