import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

// Demo seed — fictitious data, safe to commit.
// Run with: npm run seed:demo -w packages/backend

const prisma = new PrismaClient();

const ID = {
  // Gen 1
  arthur:   'demo0000-0000-0000-0000-000000000001',
  beatrice: 'demo0000-0000-0000-0000-000000000002',
  // Gen 2
  charles:  'demo0000-0000-0000-0000-000000000003',
  diana:    'demo0000-0000-0000-0000-000000000004',
  eleanor:  'demo0000-0000-0000-0000-000000000005',
  frank:    'demo0000-0000-0000-0000-000000000006',
  grace:    'demo0000-0000-0000-0000-000000000007',
  // Gen 3
  henry:    'demo0000-0000-0000-0000-000000000008',
  iris:     'demo0000-0000-0000-0000-000000000009',
  james:    'demo0000-0000-0000-0000-000000000010',
  kate:     'demo0000-0000-0000-0000-000000000011',
  leo:      'demo0000-0000-0000-0000-000000000012',
  mia:      'demo0000-0000-0000-0000-000000000013',
};

type PersonCreate = {
  id: string;
  firstName: string;
  lastName?: string;
  birthName?: string;
  gender?: 'male' | 'female' | 'other';
  dateOfBirth?: Date;
  dateOfDeath?: Date;
  placeOfBirth?: string;
  addressStreet?: string;
  addressCity?: string;
  addressCountry?: string;
  isLiving: boolean;
  bio?: string;
  createdBy: string;
};

async function upsertPerson(data: PersonCreate) {
  return prisma.person.upsert({
    where: { id: data.id },
    update: {},
    create: data,
  });
}

async function upsertSpouse(aId: string, bId: string, adminId: string, startDate?: Date) {
  return prisma.relationship.upsert({
    where: { personAId_personBId_relationshipType: { personAId: aId, personBId: bId, relationshipType: 'spouse' } },
    update: {},
    create: { personAId: aId, personBId: bId, relationshipType: 'spouse', personARole: 'spouse', personBRole: 'spouse', startDate, createdBy: adminId },
  });
}

async function upsertParentChild(parentId: string, childId: string, adminId: string) {
  return prisma.relationship.upsert({
    where: { personAId_personBId_relationshipType: { personAId: parentId, personBId: childId, relationshipType: 'parent_child' } },
    update: {},
    create: { personAId: parentId, personBId: childId, relationshipType: 'parent_child', personARole: 'parent', personBRole: 'child', createdBy: adminId },
  });
}

async function main() {
  const adminEmail = process.env.ADMIN_EMAIL ?? 'admin@example.com';
  const adminPassword = process.env.ADMIN_PASSWORD ?? 'changeme';

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: { email: adminEmail, passwordHash: await bcrypt.hash(adminPassword, 12), role: 'ADMIN', displayName: 'Admin' },
  });
  console.log(`Admin: ${admin.email}`);
  const c = admin.id;

  // Generation 1
  await upsertPerson({ id: ID.arthur, firstName: 'Arthur', lastName: 'Hill', gender: 'male',
    dateOfBirth: new Date('1920-03-14'), dateOfDeath: new Date('1998-11-02'),
    placeOfBirth: 'Edinburgh, Scotland', isLiving: false,
    addressStreet: '12 Castle Terrace', addressCity: 'Edinburgh EH1 2DP', addressCountry: 'United Kingdom',
    createdBy: c });

  await upsertPerson({ id: ID.beatrice, firstName: 'Beatrice', lastName: 'Hill', birthName: 'Osei', gender: 'female',
    dateOfBirth: new Date('1924-07-08'), dateOfDeath: new Date('2005-02-17'),
    placeOfBirth: 'Accra, Ghana', isLiving: false,
    addressStreet: '12 Castle Terrace', addressCity: 'Edinburgh EH1 2DP', addressCountry: 'United Kingdom',
    createdBy: c });

  // Generation 2
  await upsertPerson({ id: ID.charles, firstName: 'Charles', lastName: 'Hill', gender: 'male',
    dateOfBirth: new Date('1948-05-22'), placeOfBirth: 'Edinburgh, Scotland', isLiving: true,
    addressStreet: '7 Maple Avenue', addressCity: 'Toronto, ON M4C 1B3', addressCountry: 'Canada',
    createdBy: c });

  await upsertPerson({ id: ID.diana, firstName: 'Diana', lastName: 'Hill', birthName: 'Nguyen', gender: 'female',
    dateOfBirth: new Date('1951-09-30'), placeOfBirth: 'Hanoi, Vietnam', isLiving: true,
    addressStreet: '7 Maple Avenue', addressCity: 'Toronto, ON M4C 1B3', addressCountry: 'Canada',
    createdBy: c });

  await upsertPerson({ id: ID.eleanor, firstName: 'Eleanor', lastName: 'Brennan', birthName: 'Hill', gender: 'female',
    dateOfBirth: new Date('1950-11-03'), placeOfBirth: 'Edinburgh, Scotland', isLiving: true,
    addressStreet: '34 Orchard Road', addressCity: 'Cork', addressCountry: 'Ireland',
    createdBy: c });

  await upsertPerson({ id: ID.frank, firstName: 'Frank', lastName: 'Brennan', gender: 'male',
    dateOfBirth: new Date('1949-04-15'), placeOfBirth: 'Cork, Ireland', isLiving: false,
    dateOfDeath: new Date('2019-08-22'),
    addressStreet: '34 Orchard Road', addressCity: 'Cork', addressCountry: 'Ireland',
    createdBy: c });

  await upsertPerson({ id: ID.grace, firstName: 'Grace', lastName: 'Hill', gender: 'female',
    dateOfBirth: new Date('1955-01-19'), placeOfBirth: 'Edinburgh, Scotland', isLiving: true,
    addressCity: 'Melbourne, VIC 3000', addressCountry: 'Australia',
    createdBy: c });

  // Generation 3
  await upsertPerson({ id: ID.henry, firstName: 'Henry', lastName: 'Hill', gender: 'male',
    dateOfBirth: new Date('1975-06-10'), placeOfBirth: 'Toronto, Canada', isLiving: true,
    addressStreet: '88 Queen St W', addressCity: 'Toronto, ON M5H 1S2', addressCountry: 'Canada',
    createdBy: c });

  await upsertPerson({ id: ID.iris, firstName: 'Iris', lastName: 'Hill', birthName: 'Park', gender: 'female',
    dateOfBirth: new Date('1977-02-28'), placeOfBirth: 'Seoul, South Korea', isLiving: true,
    addressStreet: '88 Queen St W', addressCity: 'Toronto, ON M5H 1S2', addressCountry: 'Canada',
    createdBy: c });

  await upsertPerson({ id: ID.james, firstName: 'James', lastName: 'Hill', gender: 'male',
    dateOfBirth: new Date('1978-08-04'), placeOfBirth: 'Toronto, Canada', isLiving: true,
    addressCity: 'Vancouver, BC', addressCountry: 'Canada',
    createdBy: c });

  await upsertPerson({ id: ID.kate, firstName: 'Kate', lastName: 'Brennan', gender: 'female',
    dateOfBirth: new Date('1980-03-17'), placeOfBirth: 'Cork, Ireland', isLiving: true,
    addressCity: 'Dublin', addressCountry: 'Ireland',
    createdBy: c });

  await upsertPerson({ id: ID.leo, firstName: 'Leo', lastName: 'Brennan', gender: 'male',
    dateOfBirth: new Date('1983-10-25'), placeOfBirth: 'Cork, Ireland', isLiving: true,
    addressCity: 'London', addressCountry: 'United Kingdom',
    createdBy: c });

  await upsertPerson({ id: ID.mia, firstName: 'Mia', lastName: 'Hill', gender: 'female',
    dateOfBirth: new Date('1985-12-01'), placeOfBirth: 'Melbourne, Australia', isLiving: true,
    addressCity: 'Melbourne, VIC', addressCountry: 'Australia',
    createdBy: c });

  console.log(`Created ${Object.keys(ID).length} persons`);

  // Spouses
  await upsertSpouse(ID.arthur,  ID.beatrice, c, new Date('1946-06-01'));
  await upsertSpouse(ID.charles, ID.diana,    c, new Date('1973-08-12'));
  await upsertSpouse(ID.eleanor, ID.frank,    c, new Date('1971-09-04'));
  await upsertSpouse(ID.henry,   ID.iris,     c, new Date('2002-05-18'));

  // Arthur & Beatrice → Gen 2
  for (const child of [ID.charles, ID.eleanor, ID.grace]) {
    await upsertParentChild(ID.arthur,   child, c);
    await upsertParentChild(ID.beatrice, child, c);
  }

  // Charles & Diana → Henry, James
  for (const child of [ID.henry, ID.james]) {
    await upsertParentChild(ID.charles, child, c);
    await upsertParentChild(ID.diana,   child, c);
  }

  // Eleanor & Frank → Kate, Leo
  for (const child of [ID.kate, ID.leo]) {
    await upsertParentChild(ID.eleanor, child, c);
    await upsertParentChild(ID.frank,   child, c);
  }

  // Grace → Mia (single parent)
  await upsertParentChild(ID.grace, ID.mia, c);

  console.log('Relationships created.');
  console.log('Demo seed complete.');
}

main()
  .catch((err) => { console.error('Seed failed:', err); process.exit(1); })
  .finally(() => prisma.$disconnect());
