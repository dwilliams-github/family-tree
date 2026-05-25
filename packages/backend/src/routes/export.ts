import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { prisma } from '../db/client.js';

export const exportRouter = Router();

exportRouter.get('/markdown', requireAuth, async (_req, res, next) => {
  try {
    const [persons, relationships] = await Promise.all([
      prisma.person.findMany({ orderBy: [{ dateOfBirth: 'asc' }, { lastName: 'asc' }, { firstName: 'asc' }] }),
      prisma.relationship.findMany(),
    ]);

    // Null dateOfBirth rows sort first in Postgres ASC — move them to end
    const sorted = [
      ...persons.filter(p => p.dateOfBirth),
      ...persons.filter(p => !p.dateOfBirth),
    ];

    const nameOf = new Map(persons.map(p => [p.id, [p.firstName, p.lastName].filter(Boolean).join(' ')]));

    // Build per-person relationship index
    const spouses = new Map<string, string[]>();
    const parents = new Map<string, string[]>();
    const children = new Map<string, string[]>();
    for (const p of persons) {
      spouses.set(p.id, []);
      parents.set(p.id, []);
      children.set(p.id, []);
    }
    for (const rel of relationships) {
      if (rel.relationshipType === 'spouse') {
        spouses.get(rel.personAId)?.push(rel.personBId);
        spouses.get(rel.personBId)?.push(rel.personAId);
      } else if (rel.relationshipType === 'parent_child') {
        children.get(rel.personAId)?.push(rel.personBId);
        parents.get(rel.personBId)?.push(rel.personAId);
      }
    }

    const lines: string[] = [];
    const today = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

    lines.push('# The Yap Family Tree', '', `*${today}*`, '', '---', '');

    for (const person of sorted) {
      const fullName = nameOf.get(person.id)!;
      lines.push(`## ${fullName}`, '');

      // Subtitle line
      const subtitle: string[] = [];
      if (person.birthName) subtitle.push(`née ${person.birthName}`);
      const birthYear = person.dateOfBirth?.getFullYear();
      const deathYear = person.dateOfDeath?.getFullYear();
      if (birthYear && deathYear) subtitle.push(`${birthYear}–${deathYear}`);
      else if (birthYear) subtitle.push(`b. ${birthYear}`);
      if (person.gender) subtitle.push(person.gender.charAt(0).toUpperCase() + person.gender.slice(1).toLowerCase());
      if (subtitle.length) lines.push(subtitle.join(' · '), '');

      // Date / place details
      if (person.dateOfBirth || person.placeOfBirth) {
        const born = [formatDate(person.dateOfBirth), person.placeOfBirth].filter(Boolean).join(', ');
        lines.push(`**Born:** ${born}  `);
      }
      if (person.dateOfDeath || person.placeOfDeath) {
        const died = [formatDate(person.dateOfDeath), person.placeOfDeath].filter(Boolean).join(', ');
        lines.push(`**Died:** ${died}  `);
      }
      if (person.dateOfBirth || person.placeOfBirth || person.dateOfDeath || person.placeOfDeath) {
        lines.push('');
      }

      // Address
      const cityPostal = [person.addressCity, person.addressPostalCode].filter(Boolean).join(' ');
      const address = [person.addressStreet, cityPostal, person.addressCountry].filter(Boolean).join(', ');
      if (address) {
        const residenceLabel = person.isLiving ? 'Residence' : 'Last residence';
        lines.push(`**${residenceLabel}:** ${address}  `);
        lines.push('');
      }

      if (person.bio) {
        lines.push(person.bio.trim(), '');
      }

      // Relationships
      const mySpouses = (spouses.get(person.id) ?? []).map(id => nameOf.get(id)).filter(Boolean);
      const myParents = (parents.get(person.id) ?? []).map(id => nameOf.get(id)).filter(Boolean);
      const myChildren = (children.get(person.id) ?? []).map(id => nameOf.get(id)).filter(Boolean);

      if (mySpouses.length) lines.push(`**${mySpouses.length === 1 ? 'Spouse' : 'Spouses'}:** ${mySpouses.join(', ')}  `);
      if (myParents.length) lines.push(`**${myParents.length === 1 ? 'Parent' : 'Parents'}:** ${myParents.join(', ')}  `);
      if (myChildren.length) lines.push(`**${myChildren.length === 1 ? 'Child' : 'Children'}:** ${myChildren.join(', ')}  `);
      if (mySpouses.length || myParents.length || myChildren.length) lines.push('');

      lines.push('---', '');
    }

    const markdown = lines.join('\n');
    res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="yap-family-tree.md"');
    res.send(markdown);
  } catch (err) {
    next(err);
  }
});

function formatDate(d: Date | null): string {
  if (!d) return '';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}
