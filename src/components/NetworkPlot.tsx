'use client';

import React, { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface NetworkNode {
  id: string;
  name: string;
  numberOfStudies: number;
  sampleSize: number;
}

interface NetworkEdge {
  source: string;
  target: string;
  numberOfStudies: number;
  totalSampleSize: number;
  effectSize?: number;
  ciLower?: number;
  ciUpper?: number;
}

interface NetworkPlotProps {
  nodes: NetworkNode[];
  edges: NetworkEdge[];
  effectMeasure?: string;
  width?: number;
  height?: number;
  onNodeClick?: (node: NetworkNode) => void;
  onEdgeClick?: (edge: NetworkEdge) => void;
}

/**
 * 网状关系图组件
 * 使用SVG绘制干预措施之间的比较网络
 */
export default function NetworkPlot({
  nodes,
  edges,
  effectMeasure = 'OR',
  width = 600,
  height = 500,
  onNodeClick,
  onEdgeClick,
}: NetworkPlotProps) {
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [hoveredEdge, setHoveredEdge] = useState<string | null>(null);

  // 计算节点位置（圆形布局）
  const nodePositions = useMemo(() => {
    const positions: Record<string, { x: number; y: number }> = {};
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(width, height) / 2 - 80;

    nodes.forEach((node, index) => {
      const angle = (2 * Math.PI * index) / nodes.length - Math.PI / 2;
      positions[node.id] = {
        x: centerX + radius * Math.cos(angle),
        y: centerY + radius * Math.sin(angle),
      };
    });

    return positions;
  }, [nodes, width, height]);

  // 计算节点大小（根据涉及的研究数）
  const nodeSizes = useMemo(() => {
    const maxStudies = Math.max(...nodes.map(n => n.numberOfStudies), 1);
    const minSize = 20;
    const maxSize = 50;

    const sizes: Record<string, number> = {};
    nodes.forEach(node => {
      const ratio = node.numberOfStudies / maxStudies;
      sizes[node.id] = minSize + ratio * (maxSize - minSize);
    });

    return sizes;
  }, [nodes]);

  // 计算边粗细（根据研究数）
  const edgeWidths = useMemo(() => {
    const maxStudies = Math.max(...edges.map(e => e.numberOfStudies), 1);
    const minWidth = 1;
    const maxWidth = 8;

    const widths: Record<string, number> = {};
    edges.forEach(edge => {
      const key = `${edge.source}|${edge.target}`;
      const ratio = edge.numberOfStudies / maxStudies;
      widths[key] = minWidth + ratio * (maxWidth - minWidth);
    });

    return widths;
  }, [edges]);

  // 格式化效应量显示
  const formatEffect = (effect?: number, ciLower?: number, ciUpper?: number) => {
    if (effect === undefined) return 'N/A';
    if (effectMeasure === 'OR' || effectMeasure === 'RR' || effectMeasure === 'HR') {
      const or = Math.exp(effect);
      const lo = ciLower !== undefined ? Math.exp(ciLower) : undefined;
      const hi = ciUpper !== undefined ? Math.exp(ciUpper) : undefined;
      if (lo !== undefined && hi !== undefined) {
        return `${or.toFixed(2)} [${lo.toFixed(2)}, ${hi.toFixed(2)}]`;
      }
      return or.toFixed(2);
    }
    if (ciLower !== undefined && ciUpper !== undefined) {
      return `${effect.toFixed(3)} [${ciLower.toFixed(3)}, ${ciUpper.toFixed(3)}]`;
    }
    return effect.toFixed(3);
  };

  // 获取边颜色（根据效应量方向）
  const getEdgeColor = (effect?: number) => {
    if (effect === undefined) return '#94a3b8'; // slate-400
    if (effect > 0) return '#22c55e'; // green-500
    if (effect < 0) return '#ef4444'; // red-500
    return '#94a3b8';
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="3" />
            <circle cx="5" cy="6" r="2" />
            <circle cx="19" cy="6" r="2" />
            <circle cx="5" cy="18" r="2" />
            <circle cx="19" cy="18" r="2" />
            <line x1="9" y1="10" x2="6.5" y2="7.5" />
            <line x1="15" y1="10" x2="17.5" y2="7.5" />
            <line x1="9" y1="14" x2="6.5" y2="16.5" />
            <line x1="15" y1="14" x2="17.5" y2="16.5" />
          </svg>
          网状关系图
        </CardTitle>
        <CardDescription>
          节点大小代表研究数量，连线粗细代表比较的研究数量
        </CardDescription>
      </CardHeader>
      <CardContent>
        <TooltipProvider>
          <svg
            width={width}
            height={height}
            viewBox={`0 0 ${width} ${height}`}
            className="mx-auto"
          >
            {/* 背景 */}
            <rect width={width} height={height} fill="transparent" />

            {/* 绘制边 */}
            {edges.map((edge, index) => {
              const sourcePos = nodePositions[edge.source];
              const targetPos = nodePositions[edge.target];
              if (!sourcePos || !targetPos) return null;

              const key = `${edge.source}|${edge.target}`;
              const isHovered = hoveredEdge === key;
              const edgeWidth = edgeWidths[key] || 2;

              return (
                <g key={index}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <line
                        x1={sourcePos.x}
                        y1={sourcePos.y}
                        x2={targetPos.x}
                        y2={targetPos.y}
                        stroke={isHovered ? '#3b82f6' : getEdgeColor(edge.effectSize)}
                        strokeWidth={isHovered ? edgeWidth + 2 : edgeWidth}
                        strokeOpacity={0.7}
                        strokeLinecap="round"
                        className="cursor-pointer transition-all"
                        onMouseEnter={() => setHoveredEdge(key)}
                        onMouseLeave={() => setHoveredEdge(null)}
                        onClick={() => onEdgeClick?.(edge)}
                      />
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-xs">
                      <div className="text-sm">
                        <p className="font-medium">{edge.source} vs {edge.target}</p>
                        <p>研究数: {edge.numberOfStudies}</p>
                        <p>总样本量: {edge.totalSampleSize.toLocaleString()}</p>
                        {edge.effectSize !== undefined && (
                          <p>效应量: {formatEffect(edge.effectSize, edge.ciLower, edge.ciUpper)}</p>
                        )}
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </g>
              );
            })}

            {/* 绘制节点 */}
            {nodes.map((node) => {
              const pos = nodePositions[node.id];
              const size = nodeSizes[node.id] || 30;
              const isHovered = hoveredNode === node.id;

              return (
                <g key={node.id}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <g
                        className="cursor-pointer transition-transform"
                        style={{ transform: isHovered ? 'scale(1.1)' : 'scale(1)', transformOrigin: `${pos.x}px ${pos.y}px` }}
                        onMouseEnter={() => setHoveredNode(node.id)}
                        onMouseLeave={() => setHoveredNode(null)}
                        onClick={() => onNodeClick?.(node)}
                      >
                        {/* 外圈（高亮） */}
                        {isHovered && (
                          <circle
                            cx={pos.x}
                            cy={pos.y}
                            r={size + 5}
                            fill="none"
                            stroke="#3b82f6"
                            strokeWidth="2"
                            opacity="0.5"
                          />
                        )}

                        {/* 主圆 */}
                        <circle
                          cx={pos.x}
                          cy={pos.y}
                          r={size}
                          fill={isHovered ? '#3b82f6' : '#6366f1'}
                          stroke="white"
                          strokeWidth="2"
                        />

                        {/* 节点标签 */}
                        <text
                          x={pos.x}
                          y={pos.y + size + 15}
                          textAnchor="middle"
                          fontSize="11"
                          fill="#374151"
                          fontWeight="500"
                        >
                          {node.name.length > 10 ? node.name.substring(0, 10) + '...' : node.name}
                        </text>

                        {/* 研究数量 */}
                        <text
                          x={pos.x}
                          y={pos.y + 4}
                          textAnchor="middle"
                          fontSize="12"
                          fill="white"
                          fontWeight="bold"
                        >
                          {node.numberOfStudies}
                        </text>
                      </g>
                    </TooltipTrigger>
                    <TooltipContent side="top">
                      <div className="text-sm">
                        <p className="font-medium">{node.name}</p>
                        <p>研究数: {node.numberOfStudies}</p>
                        <p>总样本量: {node.sampleSize.toLocaleString()}</p>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </g>
              );
            })}
          </svg>
        </TooltipProvider>

        {/* 图例 */}
        <div className="flex flex-wrap gap-4 mt-4 justify-center text-sm">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-indigo-500" />
            <span>节点 = 干预措施</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-1 bg-slate-400 rounded" />
            <span>连线 = 直接比较</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex gap-1">
              <div className="w-3 h-3 rounded-full bg-green-500" />
              <div className="w-3 h-3 rounded-full bg-red-500" />
            </div>
            <span>绿/红 = 正/负效应</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
