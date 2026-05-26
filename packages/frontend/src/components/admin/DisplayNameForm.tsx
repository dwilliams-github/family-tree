import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { useAuth } from '@/auth/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';

const schema = z.object({ displayName: z.string().min(1, 'Enter a display name').max(100) });
type FormValues = z.infer<typeof schema>;

export function DisplayNameForm() {
  const { user, updateUser } = useAuth();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { displayName: user?.displayName ?? '' },
  });

  async function onSubmit({ displayName }: FormValues) {
    try {
      await updateUser(displayName);
      toast.success('Display name updated');
    } catch {
      toast.error('Failed to update display name');
    }
  }

  return (
    <div className="rounded-lg border border-border p-5 space-y-4 max-w-md">
      <div>
        <h2 className="font-semibold">Your display name</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Shown to recipients when you send an invitation.
        </p>
      </div>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex gap-2">
          <FormField control={form.control} name="displayName" render={({ field }) => (
            <FormItem className="flex-1">
              <FormLabel className="sr-only">Display name</FormLabel>
              <FormControl>
                <Input placeholder="Your name" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <Button type="submit" disabled={form.formState.isSubmitting} className="self-start mt-0">
            {form.formState.isSubmitting ? 'Saving…' : 'Save'}
          </Button>
        </form>
      </Form>
    </div>
  );
}
