import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { sendInvite } from '@/api/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';

const schema = z.object({ email: z.string().email('Enter a valid email') });
type FormValues = z.infer<typeof schema>;

export function InviteUserForm() {
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: '' },
  });

  async function onSubmit({ email }: FormValues) {
    try {
      await sendInvite(email);
      toast.success(`Invitation sent to ${email}`);
      form.reset();
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } }).response?.status;
      if (status === 409) {
        form.setError('email', { message: 'A user with that email already exists' });
      } else {
        toast.error('Failed to send invitation');
      }
    }
  }

  return (
    <div className="rounded-lg border border-border p-5 space-y-4 max-w-md">
      <div>
        <h2 className="font-semibold">Invite a user</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          They'll receive an email with a link to set their password.
        </p>
      </div>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex gap-2">
          <FormField control={form.control} name="email" render={({ field }) => (
            <FormItem className="flex-1">
              <FormLabel className="sr-only">Email address</FormLabel>
              <FormControl>
                <Input type="email" placeholder="name@example.com" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <Button type="submit" disabled={form.formState.isSubmitting} className="self-start mt-0">
            {form.formState.isSubmitting ? 'Sending…' : 'Send invite'}
          </Button>
        </form>
      </Form>
    </div>
  );
}
