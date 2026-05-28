import { useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { uploadPersonPhoto, deletePersonPhoto } from '@/api/persons';
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

  function cancel() {
    setPreview(null);
    if (inputRef.current) inputRef.current.value = '';
  }

  return (
    <div className="flex flex-col items-center gap-1.5">
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />

      {preview
        ? <img src={preview} alt="Preview" className="h-40 w-40 rounded-full object-cover" />
        : <PersonAvatar personId={person.id} hasPhoto={person.hasPhoto} firstName={person.firstName} lastName={person.lastName} size="lg" />
      }

      <div className="flex gap-2 text-xs">
        {preview ? (
          <>
            <button onClick={handleUpload} disabled={uploading}
              className="text-primary hover:underline disabled:opacity-50">
              {uploading ? 'Saving…' : 'Save'}
            </button>
            <span className="text-muted-foreground">·</span>
            <button onClick={cancel} className="text-muted-foreground hover:text-foreground">Cancel</button>
          </>
        ) : (
          <>
            <button onClick={() => inputRef.current?.click()} disabled={uploading}
              className="text-muted-foreground hover:text-foreground disabled:opacity-50">
              {person.hasPhoto ? 'Change' : 'Add photo'}
            </button>
            {person.hasPhoto && (
              <>
                <span className="text-muted-foreground">·</span>
                <button onClick={handleDelete} disabled={uploading}
                  className="text-muted-foreground hover:text-foreground disabled:opacity-50">
                  Remove
                </button>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
