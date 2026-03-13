'use client';

import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface LeagueTableComparison {
  vs: string;
  effectSize: number;
  ciLower: number;
  ciUpper: number;
  pValue: number;
  isSignificant: boolean;
}

interface LeagueTableRow {
  intervention: string;
  comparisons: LeagueTableComparison[];
}

interface LeagueTableProps {
  interventions: string[];
  table: LeagueTableRow[];
  effectMeasure?: string;
  showPValues?: boolean;
}

/**
 * 联盟表组件
 * 展示所有干预两两比较的结果矩阵
 */
export default function LeagueTable({
  interventions,
  table,
  effectMeasure = 'OR',
  showPValues = true,
}: LeagueTableProps) {
  // 格式化效应量
  const formatEffect = (
    effect: number,
    ciLower: number,
    ciUpper: number,
    measure: string
  ): string => {
    if (isNaN(effect)) return '-';

    if (measure === 'OR' || measure === 'RR' || measure === 'HR') {
      const or = Math.exp(effect);
      const lo = Math.exp(ciLower);
      const hi = Math.exp(ciUpper);
      return `${or.toFixed(2)} [${lo.toFixed(2)}, ${hi.toFixed(2)}]`;
    }

    return `${effect.toFixed(3)} [${ciLower.toFixed(3)}, ${ciUpper.toFixed(3)}]`;
  };

  // 格式化P值
  const formatPValue = (p: number): string => {
    if (isNaN(p)) return '-';
    if (p < 0.001) return '<0.001';
    return p.toFixed(3);
  };

  // 获取单元格样式
  const getCellStyle = (effect: number, isSignificant: boolean): string => {
    if (isNaN(effect)) return 'bg-slate-100 text-slate-400';
    if (!isSignificant) return 'bg-slate-50';

    if (effect > 0) {
      return 'bg-green-100 text-green-800';
    } else if (effect < 0) {
      return 'bg-red-100 text-red-800';
    }
    return 'bg-slate-50';
  };

  // 获取效应量方向指示
  const getEffectIndicator = (effect: number, rowIntervention: string, colIntervention: string): string => {
    if (isNaN(effect) || effect === 0) return '';
    if (effect > 0) {
      return ` ↑ ${colIntervention}更好`;
    } else {
      return ` ↓ ${rowIntervention}更好`;
    }
  };

  // 查找比较结果
  const findComparison = (rowIntervention: string, colIntervention: string): LeagueTableComparison | null => {
    const row = table.find(r => r.intervention === rowIntervention);
    if (!row) return null;
    return row.comparisons.find(c => c.vs === colIntervention) || null;
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <line x1="3" y1="9" x2="21" y2="9" />
            <line x1="9" y1="21" x2="9" y2="9" />
          </svg>
          联盟表 (League Table)
        </CardTitle>
        <CardDescription>
          干预措施两两比较结果矩阵
        </CardDescription>
      </CardHeader>
      <CardContent>
        <TooltipProvider>
          <div className="overflow-x-auto">
            <Table className="min-w-[600px]">
              <TableHeader>
                <TableRow>
                  <TableHead className="sticky left-0 bg-white z-10 font-bold">
                    干预措施
                  </TableHead>
                  {interventions.map((int) => (
                    <TableHead key={int} className="text-center font-bold whitespace-nowrap">
                      {int.length > 10 ? int.substring(0, 10) + '...' : int}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {interventions.map((rowIntervention, rowIndex) => {
                  const rowData = table.find(r => r.intervention === rowIntervention);
                  
                  return (
                    <TableRow key={rowIntervention}>
                      <TableCell className="sticky left-0 bg-white z-10 font-medium whitespace-nowrap">
                        {rowIntervention}
                        {rowIndex === 0 && (
                          <Badge variant="outline" className="ml-2 text-xs">参照</Badge>
                        )}
                      </TableCell>
                      {interventions.map((colIntervention, colIndex) => {
                        // 对角线（自身比较）
                        if (rowIntervention === colIntervention) {
                          return (
                            <TableCell
                              key={colIntervention}
                              className="text-center bg-slate-200 font-bold"
                            >
                              1.00
                            </TableCell>
                          );
                        }

                        const comparison = findComparison(rowIntervention, colIntervention);
                        if (!comparison) {
                          return (
                            <TableCell key={colIntervention} className="text-center text-slate-400">
                              -
                            </TableCell>
                          );
                        }

                        // 处理对角线以下（对称区域）
                        if (colIndex < rowIndex) {
                          // 显示相反的效应量
                          const reverseEffect = -comparison.effectSize;
                          const reverseCiLower = -comparison.ciUpper;
                          const reverseCiUpper = -comparison.ciLower;
                          
                          return (
                            <TableCell
                              key={colIntervention}
                              className={`text-center text-xs ${getCellStyle(reverseEffect, comparison.isSignificant)}`}
                            >
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="cursor-help">
                                    {formatEffect(reverseEffect, reverseCiLower, reverseCiUpper, effectMeasure)}
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <div className="text-sm">
                                    <p className="font-medium">{rowIntervention} vs {colIntervention}</p>
                                    <p>效应量: {formatEffect(reverseEffect, reverseCiLower, reverseCiUpper, effectMeasure)}</p>
                                    <p>P值: {formatPValue(comparison.pValue)}</p>
                                    {comparison.isSignificant && (
                                      <p className="text-green-600">统计学显著</p>
                                    )}
                                  </div>
                                </TooltipContent>
                              </Tooltip>
                            </TableCell>
                          );
                        }

                        // 对角线以上
                        return (
                          <TableCell
                            key={colIntervention}
                            className={`text-center text-xs ${getCellStyle(comparison.effectSize, comparison.isSignificant)}`}
                          >
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="cursor-help">
                                  {formatEffect(
                                    comparison.effectSize,
                                    comparison.ciLower,
                                    comparison.ciUpper,
                                    effectMeasure
                                  )}
                                </span>
                              </TooltipTrigger>
                              <TooltipContent>
                                <div className="text-sm">
                                  <p className="font-medium">{rowIntervention} vs {colIntervention}</p>
                                  <p>效应量: {formatEffect(comparison.effectSize, comparison.ciLower, comparison.ciUpper, effectMeasure)}</p>
                                  {showPValues && <p>P值: {formatPValue(comparison.pValue)}</p>}
                                  {comparison.isSignificant && (
                                    <p className="text-green-600 font-medium">统计学显著 (P&lt;0.05)</p>
                                  )}
                                  {!comparison.isSignificant && (
                                    <p className="text-slate-500">无统计学显著性</p>
                                  )}
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </TooltipProvider>

        {/* 图例 */}
        <div className="flex flex-wrap gap-4 mt-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-slate-200 rounded" />
            <span>自身比较 (OR=1)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-green-100 rounded" />
            <span>列干预更优</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-red-100 rounded" />
            <span>行干预更优</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-slate-50 border rounded" />
            <span>无显著差异</span>
          </div>
        </div>

        {/* 效应量说明 */}
        <div className="mt-4 p-3 bg-blue-50 rounded-lg text-sm">
          <p className="font-medium text-blue-800 mb-1">效应量解读 ({effectMeasure})</p>
          <ul className="text-blue-700 space-y-1 text-xs">
            <li>• {effectMeasure} &gt; 1: 列干预比行干预效果更好</li>
            <li>• {effectMeasure} &lt; 1: 行干预比列干预效果更好</li>
            <li>• 95%CI 不包含1表示差异有统计学意义</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * 简化版联盟表（仅显示主要结果）
 */
export function SimpleLeagueTable({
  comparisons,
  effectMeasure = 'OR',
}: {
  comparisons: Array<{
    interventionA: string;
    interventionB: string;
    effectSize: number;
    ciLower: number;
    ciUpper: number;
    pValue: number;
  }>;
  effectMeasure?: string;
}) {
  const formatEffect = (effect: number, ciLower: number, ciUpper: number) => {
    if (isNaN(effect)) return 'N/A';
    if (effectMeasure === 'OR' || effectMeasure === 'RR' || effectMeasure === 'HR') {
      const or = Math.exp(effect);
      const lo = Math.exp(ciLower);
      const hi = Math.exp(ciUpper);
      return `${or.toFixed(2)} [${lo.toFixed(2)}, ${hi.toFixed(2)}]`;
    }
    return `${effect.toFixed(3)} [${ciLower.toFixed(3)}, ${ciUpper.toFixed(3)}]`;
  };

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>比较</TableHead>
            <TableHead className="text-center">{effectMeasure} [95% CI]</TableHead>
            <TableHead className="text-center">P值</TableHead>
            <TableHead className="text-center">显著性</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {comparisons.map((comp, index) => (
            <TableRow key={index}>
              <TableCell className="font-medium">
                {comp.interventionA} vs {comp.interventionB}
              </TableCell>
              <TableCell className="text-center font-mono text-sm">
                {formatEffect(comp.effectSize, comp.ciLower, comp.ciUpper)}
              </TableCell>
              <TableCell className="text-center">
                {comp.pValue < 0.001 ? '<0.001' : comp.pValue.toFixed(3)}
              </TableCell>
              <TableCell className="text-center">
                {comp.pValue < 0.05 ? (
                  <Badge variant="default" className="bg-green-500">显著</Badge>
                ) : (
                  <Badge variant="outline">不显著</Badge>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
