import { useState } from 'react';
import { useAuditLog } from '@/hooks/useAudit';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import type { AuditEntry } from '@family-tree/shared';

const ACTION_COLOR: Record<string, string> = {
  INSERT: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  UPDATE: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  DELETE: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function DiffView({ entry }: { entry: AuditEntry }) {
  if (entry.action === 'INSERT') {
    return <StateBlock label="Created" state={entry.newState} />;
  }
  if (entry.action === 'DELETE') {
    return <StateBlock label="Deleted" state={entry.previousState} />;
  }
  // UPDATE — show only changed fields side-by-side
  const fields = entry.changedFields ?? [];
  if (fields.length === 0) {
    return <p className="text-xs text-muted-foreground">No field changes recorded.</p>;
  }
  return (
    <div className="space-y-2">
      {fields.map((f) => (
        <div key={f} className="grid grid-cols-[8rem_1fr_1fr] gap-2 text-xs">
          <span className="font-medium text-muted-foreground truncate">{f}</span>
          <span className="bg-red-50 dark:bg-red-950/30 rounded px-1.5 py-0.5 font-mono break-all line-through text-red-700 dark:text-red-400">
            {String(entry.previousState?.[f] ?? '—')}
          </span>
          <span className="bg-green-50 dark:bg-green-950/30 rounded px-1.5 py-0.5 font-mono break-all text-green-700 dark:text-green-400">
            {String(entry.newState?.[f] ?? '—')}
          </span>
        </div>
      ))}
    </div>
  );
}

function StateBlock({ label, state }: { label: string; state?: Record<string, unknown> }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <pre className="text-xs bg-muted rounded p-2 overflow-x-auto whitespace-pre-wrap break-all">
        {JSON.stringify(state ?? {}, null, 2)}
      </pre>
    </div>
  );
}

function AuditRow({ entry }: { entry: AuditEntry }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <>
      <tr
        className="border-b border-border hover:bg-muted/40 cursor-pointer transition-colors"
        onClick={() => setExpanded(v => !v)}
      >
        <td className="py-2 px-3 text-xs text-muted-foreground whitespace-nowrap">{formatDate(entry.createdAt)}</td>
        <td className="py-2 px-3 text-xs">{entry.performedByEmail ?? entry.performedBy.slice(0, 8)}</td>
        <td className="py-2 px-3">
          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${ACTION_COLOR[entry.action] ?? ''}`}>
            {entry.action}
          </span>
        </td>
        <td className="py-2 px-3 text-xs capitalize">{entry.tableName}</td>
        <td className="py-2 px-3 text-xs text-muted-foreground">
          {entry.changedFields?.join(', ') || '—'}
        </td>
        <td className="py-2 px-3 text-xs text-muted-foreground">{expanded ? '▲' : '▼'}</td>
      </tr>
      {expanded && (
        <tr className="border-b border-border bg-muted/20">
          <td colSpan={6} className="px-4 py-3">
            <DiffView entry={entry} />
          </td>
        </tr>
      )}
    </>
  );
}

const PAGE_SIZE = 50;

export function AuditLogViewer() {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useAuditLog(page, PAGE_SIZE);
  const totalPages = data ? Math.ceil(data.total / PAGE_SIZE) : 1;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Audit log</h2>
        {data && (
          <span className="text-sm text-muted-foreground">{data.total.toLocaleString()} entries</span>
        )}
      </div>

      <div className="rounded-lg border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="py-2 px-3 text-left text-xs font-medium text-muted-foreground">When</th>
              <th className="py-2 px-3 text-left text-xs font-medium text-muted-foreground">By</th>
              <th className="py-2 px-3 text-left text-xs font-medium text-muted-foreground">Action</th>
              <th className="py-2 px-3 text-left text-xs font-medium text-muted-foreground">Table</th>
              <th className="py-2 px-3 text-left text-xs font-medium text-muted-foreground">Changed fields</th>
              <th className="py-2 px-3 w-8" />
            </tr>
          </thead>
          <tbody>
            {isLoading
              ? Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className="border-b border-border">
                    <td colSpan={6} className="py-2 px-3">
                      <Skeleton className="h-4 w-full" />
                    </td>
                  </tr>
                ))
              : data?.entries.map(entry => <AuditRow key={entry.id} entry={entry} />)
            }
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <Button variant="outline" size="sm" onClick={() => setPage(p => p - 1)} disabled={page === 1}>
            ← Previous
          </Button>
          <span className="text-muted-foreground">Page {page} of {totalPages}</span>
          <Button variant="outline" size="sm" onClick={() => setPage(p => p + 1)} disabled={page >= totalPages}>
            Next →
          </Button>
        </div>
      )}
    </div>
  );
}
