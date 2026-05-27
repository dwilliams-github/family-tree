import type { GraphDTO } from '@family-tree/shared';

export const CARD_W = 160;
export const CARD_H = 120;

const COUPLE_GAP = 24;    // gap between adjacent spouse cards
const SUBTREE_GAP = 48;   // gap between sibling subtrees
const GEN_PITCH = 220;    // vertical distance (top-to-top) between successive generations
const MARGIN = 60;

export interface Position { x: number; y: number }

// Thin horizontal bar drawn in the gap between two adjacent spouse cards
export interface CoupleBar {
  x1: number;  // right edge of left card
  x2: number;  // left edge of right card
  y: number;   // card vertical centre (y + CARD_H / 2)
}

// One forked descent: vertical stem → horizontal crossbar → drops to each child
export interface ForkEdge {
  stemX: number;
  stemY1: number;  // bottom of parent card(s)
  crossY: number;  // halfway between parent bottom and children top
  crossX1: number; // leftmost drop X
  crossX2: number; // rightmost drop X
  drops: Array<{ x: number; y2: number }>; // x = descendant card centre, y2 = card top
}

export interface LayoutResult {
  positions: Map<string, Position>;
  coupleBars: CoupleBar[];
  forks: ForkEdge[];
  canvasWidth: number;
  canvasHeight: number;
}

// ─── internal ────────────────────────────────────────────────────────────────

interface ChildUnitRef {
  unitId: string;
  descendantId: string; // which person in that unit is the actual child
}

interface Unit {
  id: string;
  parents: string[];
  gen: number;
  leafChildIds: string[];
  childUnitRefs: ChildUnitRef[];
}

export function computeLayout(dto: GraphDTO): LayoutResult {
  const { persons, relationships } = dto;

  const empty: LayoutResult = {
    positions: new Map(), coupleBars: [], forks: [],
    canvasWidth: 0, canvasHeight: 0,
  };
  if (persons.length === 0) return empty;

  const personIds = new Set(persons.map(p => p.id));

  // Build adjacency maps
  const parentOf = new Map<string, Set<string>>();
  const spousesOf = new Map<string, Set<string>>();
  for (const id of personIds) {
    parentOf.set(id, new Set());
    spousesOf.set(id, new Set());
  }
  for (const rel of relationships) {
    if (!personIds.has(rel.personAId) || !personIds.has(rel.personBId)) continue;
    if (rel.type === 'parent_child') {
      parentOf.get(rel.personAId)!.add(rel.personBId);
    } else if (rel.type === 'spouse') {
      spousesOf.get(rel.personAId)!.add(rel.personBId);
      spousesOf.get(rel.personBId)!.add(rel.personAId);
    }
  }

  const gens = computeGenerations([...personIds], parentOf, spousesOf);

  // ── Build family units ──────────────────────────────────────────────────────

  const units = new Map<string, Unit>();
  const personToUnit = new Map<string, string>(); // first unit wins per person

  // Couple units
  const seenCouples = new Set<string>();
  for (const person of persons) {
    for (const spouseId of spousesOf.get(person.id) ?? []) {
      const key = [person.id, spouseId].sort().join('|');
      if (seenCouples.has(key)) continue;
      seenCouples.add(key);

      units.set(key, {
        id: key,
        parents: [person.id, spouseId],
        gen: gens.get(person.id) ?? 0,
        leafChildIds: [],
        childUnitRefs: [],
      });
      if (!personToUnit.has(person.id)) personToUnit.set(person.id, key);
      if (!personToUnit.has(spouseId)) personToUnit.set(spouseId, key);
    }
  }

  // Single-parent units
  for (const person of persons) {
    if (personToUnit.has(person.id)) continue;
    if ((parentOf.get(person.id)?.size ?? 0) === 0) continue;
    const unitId = `${person.id}|single`;
    units.set(unitId, {
      id: unitId, parents: [person.id],
      gen: gens.get(person.id) ?? 0,
      leafChildIds: [], childUnitRefs: [],
    });
    personToUnit.set(person.id, unitId);
  }

  // Birth date lookup for child ordering (missing dates sort last)
  const birthYear = new Map<string, number>();
  const createdAt = new Map<string, number>();
  for (const p of persons) {
    if (p.dateOfBirth) birthYear.set(p.id, parseInt(p.dateOfBirth.slice(0, 4), 10));
    createdAt.set(p.id, new Date(p.createdAt).getTime());
  }
  const byBirth = (a: string, b: string) => {
    const ba = birthYear.get(a), bb = birthYear.get(b);
    if (ba !== undefined && bb !== undefined) return ba - bb;
    if (ba !== undefined) return -1;
    if (bb !== undefined) return 1;
    return (createdAt.get(a) ?? 0) - (createdAt.get(b) ?? 0);
  };

  // Assign children to units; track which person in the child unit is the descendant
  const assignedAsChild = new Set<string>();

  for (const unit of units.values()) {
    if (unit.parents.length !== 2) continue;
    const [pA, pB] = unit.parents;
    const childrenB = parentOf.get(pB)!;
    for (const childId of parentOf.get(pA)!) {
      if (!childrenB.has(childId) || assignedAsChild.has(childId)) continue;
      assignedAsChild.add(childId);
      const cu = personToUnit.get(childId);
      cu
        ? unit.childUnitRefs.push({ unitId: cu, descendantId: childId })
        : unit.leafChildIds.push(childId);
    }
    unit.leafChildIds.sort(byBirth);
    unit.childUnitRefs.sort((a, b) => byBirth(a.descendantId, b.descendantId));
  }
  for (const unit of units.values()) {
    if (unit.parents.length !== 1) continue;
    for (const childId of parentOf.get(unit.parents[0])!) {
      if (assignedAsChild.has(childId)) continue;
      assignedAsChild.add(childId);
      const cu = personToUnit.get(childId);
      cu
        ? unit.childUnitRefs.push({ unitId: cu, descendantId: childId })
        : unit.leafChildIds.push(childId);
    }
    unit.leafChildIds.sort(byBirth);
    unit.childUnitRefs.sort((a, b) => byBirth(a.descendantId, b.descendantId));
  }

  // Root units = not referenced as a child unit by any other
  const nonRoots = new Set<string>();
  for (const unit of units.values()) {
    for (const ref of unit.childUnitRefs) nonRoots.add(ref.unitId);
  }
  const rootUnitIds = [...units.keys()].filter(id => !nonRoots.has(id));

  // ── Subtree widths (bottom-up, memoised) ────────────────────────────────────

  const subtreeW = new Map<string, number>();
  function unitWidth(unitId: string): number {
    if (subtreeW.has(unitId)) return subtreeW.get(unitId)!;
    const unit = units.get(unitId)!;
    const parentsW = unit.parents.length === 2 ? 2 * CARD_W + COUPLE_GAP : CARD_W;
    const childWs = [
      ...unit.leafChildIds.map(() => CARD_W),
      ...unit.childUnitRefs.map(ref => unitWidth(ref.unitId)),
    ];
    const childrenW = childWs.length === 0 ? 0
      : childWs.reduce((s, w) => s + w, 0) + (childWs.length - 1) * SUBTREE_GAP;
    const w = Math.max(parentsW, childrenW);
    subtreeW.set(unitId, w);
    return w;
  }
  for (const id of rootUnitIds) unitWidth(id);

  // ── Position assignment (top-down) ──────────────────────────────────────────

  const positions = new Map<string, Position>();
  const coupleBars: CoupleBar[] = [];
  const forks: ForkEdge[] = [];

  type Item =
    | { kind: 'leaf'; id: string; width: number }
    | { kind: 'unit'; unitId: string; descendantId: string; width: number };

  function placeUnit(unitId: string, centerX: number): void {
    const unit = units.get(unitId)!;
    const y = unit.gen * GEN_PITCH + MARGIN;

    if (unit.parents.length === 2) {
      const [pA, pB] = unit.parents;
      positions.set(pA, { x: centerX - CARD_W - COUPLE_GAP / 2, y });
      positions.set(pB, { x: centerX + COUPLE_GAP / 2, y });
      coupleBars.push({ x1: centerX - COUPLE_GAP / 2, x2: centerX + COUPLE_GAP / 2, y: y + CARD_H / 2 });
    } else {
      positions.set(unit.parents[0], { x: centerX - CARD_W / 2, y });
    }

    const allItems: Item[] = [
      ...unit.leafChildIds.map(id => ({ kind: 'leaf' as const, id, width: CARD_W })),
      ...unit.childUnitRefs.map(ref => ({
        kind: 'unit' as const,
        unitId: ref.unitId,
        descendantId: ref.descendantId,
        width: unitWidth(ref.unitId),
      })),
    ];
    if (allItems.length === 0) return;

    const totalChildW = allItems.reduce((s, item) => s + item.width, 0)
      + (allItems.length - 1) * SUBTREE_GAP;
    let itemX = centerX - totalChildW / 2;

    const drops: Array<{ x: number; y2: number }> = [];

    for (const item of allItems) {
      const itemCX = itemX + item.width / 2;
      let dropX: number;
      let childTopY: number;

      if (item.kind === 'leaf') {
        childTopY = (gens.get(item.id) ?? unit.gen + 1) * GEN_PITCH + MARGIN;
        positions.set(item.id, { x: itemX, y: childTopY });
        dropX = itemCX; // card centre
      } else {
        placeUnit(item.unitId, itemCX);
        childTopY = units.get(item.unitId)!.gen * GEN_PITCH + MARGIN;
        // Drop to the descendant's card centre, not the unit midpoint
        const descPos = positions.get(item.descendantId)!;
        dropX = descPos.x + CARD_W / 2;
      }

      drops.push({ x: dropX, y2: childTopY });
      itemX += item.width + SUBTREE_GAP;
    }

    const stemY1 = y + CARD_H;
    const minChildTop = Math.min(...drops.map(d => d.y2));
    const crossY = (stemY1 + minChildTop) / 2;

    forks.push({
      stemX: centerX,
      stemY1,
      crossY,
      crossX1: drops[0].x,
      crossX2: drops[drops.length - 1].x,
      drops,
    });
  }

  let x = MARGIN;
  for (const unitId of rootUnitIds) {
    const w = unitWidth(unitId);
    placeUnit(unitId, x + w / 2);
    x += w + SUBTREE_GAP;
  }

  // Isolated persons not covered by any unit
  const covered = new Set<string>();
  for (const unit of units.values()) {
    for (const p of unit.parents) covered.add(p);
    for (const c of unit.leafChildIds) covered.add(c);
  }
  for (const person of persons) {
    if (!covered.has(person.id) && !positions.has(person.id)) {
      positions.set(person.id, { x, y: (gens.get(person.id) ?? 0) * GEN_PITCH + MARGIN });
      x += CARD_W + SUBTREE_GAP;
    }
  }

  // Canvas bounds
  let maxX = 0, maxY = 0;
  for (const pos of positions.values()) {
    maxX = Math.max(maxX, pos.x + CARD_W);
    maxY = Math.max(maxY, pos.y + CARD_H);
  }

  return { positions, coupleBars, forks, canvasWidth: maxX + MARGIN, canvasHeight: maxY + MARGIN };
}

// ─── generation computation ───────────────────────────────────────────────────

function computeGenerations(
  nodeIds: string[],
  parentOf: Map<string, Set<string>>,
  spousesOf: Map<string, Set<string>>,
): Map<string, number> {
  const parentsOf = new Map<string, Set<string>>();
  for (const id of nodeIds) parentsOf.set(id, new Set());
  for (const [parent, children] of parentOf) {
    for (const child of children) parentsOf.get(child)?.add(parent);
  }

  const gen = new Map<string, number>();

  function propagate(start: string): void {
    const q = [start];
    let h = 0;
    while (h < q.length) {
      const id = q[h++];
      const g = gen.get(id)!;
      for (const child of parentOf.get(id) ?? []) {
        const proposed = g + 1;
        if ((gen.get(child) ?? -Infinity) < proposed) {
          gen.set(child, proposed);
          q.push(child);
        }
      }
    }
  }

  for (const id of nodeIds) {
    if ((parentsOf.get(id)?.size ?? 0) === 0) {
      gen.set(id, 0);
      propagate(id);
    }
  }

  // Spouse equalisation
  let changed = true;
  while (changed) {
    changed = false;
    for (const id of nodeIds) {
      const g = gen.get(id);
      if (g === undefined) continue;
      for (const sid of spousesOf.get(id) ?? []) {
        const sg = gen.get(sid);
        if (sg === undefined || g === sg) continue;
        const maxG = Math.max(g, sg);
        if (g < maxG) { gen.set(id, maxG); changed = true; propagate(id); }
        if ((gen.get(sid) ?? sg) < maxG) { gen.set(sid, maxG); changed = true; propagate(sid); }
      }
    }
  }

  for (const id of nodeIds) if (!gen.has(id)) gen.set(id, 0);
  return gen;
}
