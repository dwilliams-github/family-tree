export type AuditAction = 'INSERT' | 'UPDATE' | 'DELETE';
export type AuditTable = 'persons' | 'relationships';

export interface AuditEntry {
  id: string;
  tableName: AuditTable;
  recordId: string;
  action: AuditAction;
  performedBy: string;
  performedByEmail?: string;
  previousState?: Record<string, unknown>;
  newState?: Record<string, unknown>;
  changedFields?: string[];
  ipAddress?: string;
  createdAt: string;
}
