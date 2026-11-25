import { Notice } from '@/components/Notice';
import type { SoftNote } from '../consistency';

interface NoteForProps {
  notes: readonly SoftNote[];
  id: string;
}

/** Pokazuje miękką uwagę o danym id, jeśli w tej chwili obowiązuje. */
export function NoteFor({ notes, id }: NoteForProps) {
  const note = notes.find((n) => n.id === id);
  if (!note) return null;
  return <Notice tone={note.tone}>{note.text}</Notice>;
}
