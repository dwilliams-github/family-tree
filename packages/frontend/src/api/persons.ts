import { api } from './client';
import type { Person, PersonInput } from '@family-tree/shared';

export async function getPerson(id: string): Promise<Person> {
  const res = await api.get<Person>(`/persons/${id}`);
  return res.data;
}

export async function createPerson(input: PersonInput): Promise<Person> {
  const res = await api.post<Person>('/persons', input);
  return res.data;
}

export async function updatePerson(id: string, input: Partial<PersonInput>): Promise<Person> {
  const res = await api.put<Person>(`/persons/${id}`, input);
  return res.data;
}

export async function deletePerson(id: string): Promise<void> {
  await api.delete(`/persons/${id}`);
}

export async function getPersonPhotoBlobUrl(id: string): Promise<string> {
  const res = await api.get(`/persons/${id}/photo`, { responseType: 'blob' });
  return URL.createObjectURL(res.data as Blob);
}

export async function uploadPersonPhoto(id: string, file: File): Promise<void> {
  const form = new FormData();
  form.append('photo', file);
  await api.put(`/persons/${id}/photo`, form);
}

export async function deletePersonPhoto(id: string): Promise<void> {
  await api.delete(`/persons/${id}/photo`);
}
