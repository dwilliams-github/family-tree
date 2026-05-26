import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '@/auth/AuthContext';
import { getInvite, acceptInvite } from '@/api/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';

const schema = z
  .object({
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, {
    message: 'Passwords do not match',
    path: ['confirm'],
  });
type FormValues = z.infer<typeof schema>;

export function AcceptInvitePage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const [email, setEmail] = useState<string | null>(null);
  const [tokenError, setTokenError] = useState<string | null>(null);
  const { login: setToken } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!token) { setTokenError('No invitation token provided.'); return; }
    getInvite(token)
      .then((data) => setEmail(data.email))
      .catch(() => setTokenError('This invitation link is invalid or has expired.'));
  }, [token]);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { password: '', confirm: '' },
  });

  const { formState: { isSubmitting, errors } } = form;

  async function onSubmit(values: FormValues) {
    try {
      const res = await acceptInvite(token, values.password);
      setToken(res.token);
      navigate('/', { replace: true });
    } catch {
      form.setError('root', { message: 'Failed to accept invitation. The link may have expired.' });
    }
  }

  if (tokenError) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center space-y-2">
          <p className="text-destructive font-medium">{tokenError}</p>
          <p className="text-sm text-muted-foreground">Please ask an admin to resend your invitation.</p>
        </div>
      </div>
    );
  }

  if (!email) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground text-sm">Validating invitation…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Create your account</h1>
          <p className="text-sm text-muted-foreground">
            Joining as <span className="font-medium text-foreground">{email}</span>
          </p>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Password</FormLabel>
                  <FormControl>
                    <Input type="password" autoComplete="new-password" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="confirm"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Confirm password</FormLabel>
                  <FormControl>
                    <Input type="password" autoComplete="new-password" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <details className="group text-sm">
              <summary className="cursor-pointer text-muted-foreground hover:text-foreground list-none flex items-center gap-1 select-none w-fit">
                <span className="transition-transform group-open:rotate-90">›</span>
                Password tip
              </summary>
              <p className="mt-1.5 text-muted-foreground pl-4">
                Choose a password you don't use anywhere else. A passphrase or password manager suggestion works well.
              </p>
            </details>

            {errors.root && (
              <p className="text-sm text-destructive text-center">{errors.root.message}</p>
            )}

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? 'Creating account…' : 'Create account'}
            </Button>
          </form>
        </Form>
      </div>
    </div>
  );
}
