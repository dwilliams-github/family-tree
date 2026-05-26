import { useQuery } from '@tanstack/react-query';
import { getUsers } from '@/api/auth';
import { Badge } from '@/components/ui/badge';

export function UserList() {
  const { data: users, isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: getUsers,
  });

  return (
    <div className="space-y-4">
      <h2 className="font-semibold">Users</h2>
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left px-4 py-2 font-medium text-muted-foreground">Email</th>
                <th className="text-left px-4 py-2 font-medium text-muted-foreground">Name</th>
                <th className="text-left px-4 py-2 font-medium text-muted-foreground">Role</th>
                <th className="text-left px-4 py-2 font-medium text-muted-foreground">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {users?.map(u => (
                <tr key={u.id}>
                  <td className="px-4 py-2">{u.email}</td>
                  <td className="px-4 py-2 text-muted-foreground">{u.displayName ?? '—'}</td>
                  <td className="px-4 py-2">
                    {u.status === 'pending' ? (
                      <Badge variant="outline">pending</Badge>
                    ) : (
                      <Badge variant={u.role === 'ADMIN' ? 'default' : 'secondary'}>
                        {u.role!.toLowerCase()}
                      </Badge>
                    )}
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">
                    {u.status === 'pending'
                      ? <span className="italic">invited {new Date(u.createdAt).toLocaleDateString()}</span>
                      : new Date(u.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
