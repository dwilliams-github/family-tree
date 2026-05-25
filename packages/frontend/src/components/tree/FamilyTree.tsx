import { useMemo, useCallback } from 'react';
import { ReactFlow, Controls, MiniMap, Background, BackgroundVariant, type NodeMouseHandler } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useTree } from '@/hooks/useTree';
import { Skeleton } from '@/components/ui/skeleton';
import { graphToFlow } from './treeTransform';
import { applyDagreLayout } from './treeLayout';
import { PersonNode } from './PersonNode';
import { PersonEdge } from './PersonEdge';

const nodeTypes = { personNode: PersonNode };
const edgeTypes = { personEdge: PersonEdge };

interface Props {
  onPersonSelect: (id: string) => void;
}

export function FamilyTree({ onPersonSelect }: Props) {
  const { data, isLoading, isError } = useTree();

  const { nodes, edges } = useMemo(() => {
    if (!data) return { nodes: [], edges: [] };
    const { nodes: rawNodes, edges: rawEdges } = graphToFlow(data);
    return { nodes: applyDagreLayout(rawNodes, rawEdges), edges: rawEdges };
  }, [data]);

  const handleNodeClick = useCallback<NodeMouseHandler>((_event, node) => {
    onPersonSelect(node.id);
  }, [onPersonSelect]);

  if (isLoading) {
    return (
      <div className="w-full h-full flex items-center justify-center gap-4 flex-col">
        <Skeleton className="h-20 w-40 rounded-lg" />
        <div className="flex gap-4">
          <Skeleton className="h-20 w-40 rounded-lg" />
          <Skeleton className="h-20 w-40 rounded-lg" />
        </div>
        <p className="text-sm text-muted-foreground">Loading family tree…</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <p className="text-sm text-destructive">Failed to load family tree.</p>
      </div>
    );
  }

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      onNodeClick={handleNodeClick}
      nodesDraggable={false}
      nodesConnectable={false}
      fitView
      fitViewOptions={{ padding: 0.15 }}
      minZoom={0.1}
      maxZoom={2}
    >
      <Controls />
      <MiniMap
        nodeColor={(node) => {
          const person = (node.data as { person?: { isLiving?: boolean } }).person;
          return person?.isLiving ? '#e2e8f0' : '#cbd5e1';
        }}
        maskColor="rgb(0,0,0,0.05)"
      />
      <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#e2e8f0" />
    </ReactFlow>
  );
}
