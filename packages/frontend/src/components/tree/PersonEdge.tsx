import { BaseEdge, getStraightPath, type EdgeProps } from '@xyflow/react';

type RelType = 'parent_child' | 'spouse' | 'sibling';

const STROKE: Record<RelType, { stroke: string; strokeDasharray?: string; strokeWidth: number }> = {
  parent_child: { stroke: '#94a3b8', strokeWidth: 1.5 },
  spouse:       { stroke: '#f59e0b', strokeWidth: 1.5, strokeDasharray: '6 3' },
  sibling:      { stroke: '#94a3b8', strokeWidth: 1,   strokeDasharray: '3 3' },
};

export function PersonEdge({
  sourceX, sourceY, targetX, targetY, data,
}: EdgeProps) {
  const [edgePath] = getStraightPath({ sourceX, sourceY, targetX, targetY });
  const relType = (data?.relType as RelType) ?? 'parent_child';
  const style = STROKE[relType] ?? STROKE.parent_child;

  return <BaseEdge path={edgePath} style={style} />;
}
