import { Link } from 'react-router-dom';
import { useAuth } from '@/auth/AuthContext';
import { Button } from '@/components/ui/button';
import { InviteUserForm } from '@/components/admin/InviteUserForm';
import { AuditLogViewer } from '@/components/admin/AuditLogViewer';
import { downloadMarkdown } from '@/api/export';
import { toast } from 'sonner';

export function AdminPage() {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            ← Tree
          </Link>
          <h1 className="font-semibold">Admin</h1>
        </div>
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <span>{user?.displayName ?? user?.email}</span>
          <Button size="sm" variant="outline" onClick={() => downloadMarkdown().catch(() => toast.error('Export failed'))}>
            Export
          </Button>
          <Button size="sm" variant="outline" onClick={logout}>Sign out</Button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8 space-y-10 min-h-[calc(100vh-8rem)]">
        <InviteUserForm />
        <AuditLogViewer />
      </main>
      <footer className="border-t border-border px-6 py-3 text-xs text-muted-foreground text-center">
        The Yap Family Tree
      </footer>
    </div>
  );
}
