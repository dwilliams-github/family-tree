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

  async function submit(email: string, sendEmail: boolean) {
    try {
      const { link } = await sendInvite(email, sendEmail);
      if (sendEmail) {
        toast.success(`Invitation sent to ${email}`);
      } else {
        await navigator.clipboard.writeText(link);
        toast.success('Invite link copied to clipboard');
      }
      form.reset();
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } }).response?.status;
      if (status === 409) {
        form.setError('email', { message: 'A user with that email already exists' });
      } else {
        toast.error(sendEmail ? 'Failed to send invitation' : 'Failed to generate link');
      }
    }
  }

  const { isSubmitting } = form.formState;

  return (
    <div className="rounded-lg border border-border p-5 space-y-4 max-w-md">
      <div>
        <h2 className="font-semibold">Invite a user</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Send an invite email, or copy the link to share personally.
        </p>
      </div>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(({ email }) => submit(email, true))} className="flex gap-2">
          <FormField control={form.control} name="email" render={({ field }) => (
            <FormItem className="flex-1">
              <FormLabel className="sr-only">Email address</FormLabel>
              <FormControl>
                <Input type="email" placeholder="name@example.com" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <Button type="submit" disabled={isSubmitting} className="self-start mt-0">
            {isSubmitting ? 'Sending…' : 'Send invite'}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={isSubmitting}
            className="self-start mt-0"
            onClick={form.handleSubmit(({ email }) => submit(email, false))}
          >
            Copy link
          </Button>
        </form>
      </Form>
    </div>
  );
}
