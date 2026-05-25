import { useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { uploadPersonPhoto, deletePersonPhoto } from '@/api/persons';
import { Button } from '@/components/ui/button';
import { PersonAvatar } from './PersonAvatar';
import type { PersonSummary } from '@family-tree/shared';

interface Props {
  person: PersonSummary;
}

export function PhotoUpload({ person }: Props) {
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPreview(URL.createObjectURL(file));
  }

  async function handleUpload() {
    const file = inputRef.current?.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      await uploadPersonPhoto(person.id, file);
      await qc.invalidateQueries({ queryKey: ['tree'] });
      await qc.invalidateQueries({ queryKey: ['person', person.id] });
      setPreview(null);
      if (inputRef.current) inputRef.current.value = '';
      toast.success('Photo updated');
    } catch {
      toast.error('Failed to upload photo');
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete() {
    setUploading(true);
    try {
      await deletePersonPhoto(person.id);
      await qc.invalidateQueries({ queryKey: ['tree'] });
      await qc.invalidateQueries({ queryKey: ['person', person.id] });
      setPreview(null);
      toast.success('Photo removed');
    } catch {
      toast.error('Failed to remove photo');
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="flex items-center gap-4">
      {preview
        ? <img src={preview} alt="Preview" className="h-24 w-24 rounded-full object-cover" />
        : <PersonAvatar personId={person.id} hasPhoto={person.hasPhoto} firstName={person.firstName} lastName={person.lastName} size="lg" />
      }
      <div className="flex flex-col gap-2">
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />
        {preview ? (
          <div className="flex gap-2">
            <Button size="sm" onClick={handleUpload} disabled={uploading}>
              {uploading ? 'Uploading…' : 'Save photo'}
            </Button>
            <Button size="sm" variant="outline" onClick={() => { setPreview(null); if (inputRef.current) inputRef.current.value = ''; }}>
              Cancel
            </Button>
          </div>
        ) : (
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => inputRef.current?.click()} disabled={uploading}>
              {person.hasPhoto ? 'Change photo' : 'Add photo'}
            </Button>
            {person.hasPhoto && (
              <Button size="sm" variant="outline" onClick={handleDelete} disabled={uploading}>
                Remove
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
