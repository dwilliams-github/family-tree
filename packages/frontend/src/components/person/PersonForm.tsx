import { useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { createPerson, updatePerson } from '@/api/persons';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import type { Person } from '@family-tree/shared';

const schema = z.object({
  firstName: z.string().min(1, 'Required'),
  lastName: z.string().optional(),
  birthName: z.string().optional(),
  gender: z.enum(['male', 'female', 'other', '']).optional(),
  dateOfBirth: z.string().optional(),
  dateOfDeath: z.string().optional(),
  placeOfBirth: z.string().optional(),
  placeOfDeath: z.string().optional(),
  addressStreet: z.string().optional(),
  addressCity: z.string().optional(),
  addressPostalCode: z.string().optional(),
  addressCountry: z.string().optional(),
  bio: z.string().optional(),
  isLiving: z.boolean().optional(),
});
type FormValues = z.infer<typeof schema>;

function toInput(v: FormValues) {
  return {
    firstName: v.firstName,
    lastName: v.lastName || undefined,
    birthName: v.birthName || undefined,
    gender: (v.gender || undefined) as 'male' | 'female' | 'other' | undefined,
    dateOfBirth: v.dateOfBirth || undefined,
    dateOfDeath: v.dateOfDeath || undefined,
    placeOfBirth: v.placeOfBirth || undefined,
    placeOfDeath: v.placeOfDeath || undefined,
    addressStreet: v.addressStreet || undefined,
    addressCity: v.addressCity || undefined,
    addressPostalCode: v.addressPostalCode || undefined,
    addressCountry: v.addressCountry || undefined,
    bio: v.bio || undefined,
    isLiving: v.isLiving,
  };
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  person?: Person;
  onCreated?: (id: string) => void;
}

export function PersonForm({ open, onOpenChange, person, onCreated }: Props) {
  const qc = useQueryClient();
  const isEdit = !!person;

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    values: person
      ? {
          firstName: person.firstName,
          lastName: person.lastName ?? '',
          birthName: person.birthName ?? '',
          gender: (person.gender ?? '') as FormValues['gender'],
          dateOfBirth: person.dateOfBirth ?? '',
          dateOfDeath: person.dateOfDeath ?? '',
          placeOfBirth: person.placeOfBirth ?? '',
          placeOfDeath: person.placeOfDeath ?? '',
          addressStreet: person.addressStreet ?? '',
          addressCity: person.addressCity ?? '',
          addressPostalCode: person.addressPostalCode ?? '',
          addressCountry: person.addressCountry ?? '',
          bio: person.bio ?? '',
          isLiving: person.isLiving,
        }
      : { firstName: '', isLiving: true },
  });

  const isLiving = form.watch('isLiving') ?? true;

  async function onSubmit(values: FormValues) {
    try {
      if (isEdit) {
        await updatePerson(person.id, toInput(values));
        await qc.invalidateQueries({ queryKey: ['person', person.id] });
        toast.success('Person updated');
      } else {
        const created = await createPerson(toInput(values));
        toast.success('Person added');
        await qc.invalidateQueries({ queryKey: ['tree'] });
        onOpenChange(false);
        onCreated?.(created.id);
        return;
      }
      await qc.invalidateQueries({ queryKey: ['tree'] });
      onOpenChange(false);
    } catch {
      toast.error(isEdit ? 'Failed to update person' : 'Failed to add person');
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit person' : 'Add person'}</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <FormField control={form.control} name="firstName" render={({ field }) => (
                <FormItem>
                  <FormLabel>First name *</FormLabel>
                  <FormControl><Input {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="lastName" render={({ field }) => (
                <FormItem>
                  <FormLabel>Last name</FormLabel>
                  <FormControl><Input {...field} /></FormControl>
                </FormItem>
              )} />
            </div>

            <FormField control={form.control} name="birthName" render={({ field }) => (
              <FormItem>
                <FormLabel>Birth / maiden name</FormLabel>
                <FormControl><Input {...field} /></FormControl>
              </FormItem>
            )} />

            <div className="grid grid-cols-2 gap-3">
              <FormField control={form.control} name="gender" render={({ field }) => (
                <FormItem>
                  <FormLabel>Gender</FormLabel>
                  <FormControl>
                    <select {...field} className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm">
                      <option value="">—</option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other</option>
                    </select>
                  </FormControl>
                </FormItem>
              )} />
              <FormField control={form.control} name="isLiving" render={({ field }) => (
                <FormItem className="flex flex-col justify-end pb-1">
                  <FormLabel>Status</FormLabel>
                  <div className="flex items-center gap-2 h-9">
                    <input
                      type="checkbox"
                      id="isLiving"
                      checked={field.value ?? true}
                      onChange={e => field.onChange(e.target.checked)}
                      className="h-4 w-4 rounded border-input"
                    />
                    <label htmlFor="isLiving" className="text-sm">Living</label>
                  </div>
                </FormItem>
              )} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <FormField control={form.control} name="dateOfBirth" render={({ field }) => (
                <FormItem>
                  <FormLabel>Date of birth</FormLabel>
                  <FormControl><Input type="date" {...field} /></FormControl>
                </FormItem>
              )} />
              <FormField control={form.control} name="dateOfDeath" render={({ field }) => (
                <FormItem className={isLiving ? 'opacity-40' : ''}>
                  <FormLabel>Date of death</FormLabel>
                  <FormControl><Input type="date" disabled={isLiving} {...field} /></FormControl>
                </FormItem>
              )} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <FormField control={form.control} name="placeOfBirth" render={({ field }) => (
                <FormItem>
                  <FormLabel>Place of birth</FormLabel>
                  <FormControl><Input {...field} /></FormControl>
                </FormItem>
              )} />
              <FormField control={form.control} name="placeOfDeath" render={({ field }) => (
                <FormItem className={isLiving ? 'opacity-40' : ''}>
                  <FormLabel>Place of death</FormLabel>
                  <FormControl><Input disabled={isLiving} {...field} /></FormControl>
                </FormItem>
              )} />
            </div>

            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Residence</p>
              <FormField control={form.control} name="addressStreet" render={({ field }) => (
                <FormItem>
                  <FormLabel>Street</FormLabel>
                  <FormControl><Input {...field} placeholder="123 Main St" /></FormControl>
                </FormItem>
              )} />
              <div className="grid grid-cols-2 gap-3">
                <FormField control={form.control} name="addressCity" render={({ field }) => (
                  <FormItem>
                    <FormLabel>City / State</FormLabel>
                    <FormControl><Input {...field} placeholder="Boston, MA" /></FormControl>
                  </FormItem>
                )} />
                <FormField control={form.control} name="addressPostalCode" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Postal code</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                  </FormItem>
                )} />
              </div>
              <FormField control={form.control} name="addressCountry" render={({ field }) => (
                <FormItem>
                  <FormLabel>Country</FormLabel>
                  <FormControl><Input {...field} /></FormControl>
                </FormItem>
              )} />
            </div>

            <FormField control={form.control} name="bio" render={({ field }) => (
              <FormItem>
                <FormLabel>Notes / bio</FormLabel>
                <FormControl>
                  <textarea
                    {...field}
                    rows={3}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none"
                  />
                </FormControl>
              </FormItem>
            )} />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? 'Saving…' : 'Save'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
