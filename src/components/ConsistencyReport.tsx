'use client';

import React from 'react';
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
import { AlertTriangle, CheckCircle, AlertCircle } from 'lucide-react';

interface ConsistencyResult {
  testMethod: string;
  loop?: string[];
  directEffect: number;
  indirectEffect: number;
  difference: number;
  differenceSe: number;
  consistencyPValue: number;
  isConsistent: boolean;
  conclusion: string;
}

interface ConsistencyReportProps {
  results: ConsistencyResult[];
  effectMeasure?: string;
}

/**
 * 一致性检验报告组件
 * 展示直接证据与间接证据的一致性检验结果
 */
export default function ConsistencyReport({
  results,
  effectMeasure = 'OR',
}: ConsistencyReportProps) {
  // 格式化效应量
  const formatEffect = (effect: number) => {
    if (isNaN(effect)) return '-';
    if (effectMeasure === 'OR' || effectMeasure === 'RR' || effectMeasure === 'HR') {
      return Math.exp(effect).toFixed(2);
    }
    return effect.toFixed(3);
  };

  // 格式化P值
  const formatPValue = (p: number) => {
    if (isNaN(p)) return '-';
    if (p < 0.001) return '<0.001';
    return p.toFixed(3);
  };

  // 计算一致性统计
  const consistentCount = results.filter(r => r.isConsistent).length;
  const inconsistentCount = results.length - consistentCount;
  const allConsistent = consistentCount === results.length && results.length > 0;

  // 整体一致性结论
  const overallConclusion = allConsistent
    ? '所有比较的直接证据与间接证据一致，网状Meta分析结果可信。'
    : inconsistentCount === results.length
    ? '多数比较存在不一致，建议谨慎解读结果或使用分离模型。'
    : '部分比较存在不一致，建议进一步调查不一致原因。';

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 12l2 2 4-4" />
            <circle cx="12" cy="12" r="10" />
          </svg>
          一致性检验报告
        </CardTitle>
        <CardDescription>
          检验直接证据与间接证据的一致性
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* 总体结论 */}
        <div
          className={`p-4 rounded-lg mb-4 ${
            allConsistent
              ? 'bg-green-50 border border-green-200'
              : 'bg-amber-50 border border-amber-200'
          }`}
        >
          <div className="flex items-start gap-3">
            {allConsistent ? (
              <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
            ) : (
              <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
            )}
            <div>
              <p
                className={`font-medium ${
                  allConsistent ? 'text-green-800' : 'text-amber-800'
                }`}
              >
                {allConsistent ? '一致性好' : '存在不一致'}
              </p>
              <p
                className={`text-sm mt-1 ${
                  allConsistent ? 'text-green-700' : 'text-amber-700'
                }`}
              >
                {overallConclusion}
              </p>
              <p className="text-sm mt-2">
                一致: {consistentCount} 个比较 / 不一致: {inconsistentCount} 个比较
              </p>
            </div>
          </div>
        </div>

        {/* 详细结果表格 */}
        {results.length > 0 && (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>比较对</TableHead>
                  <TableHead className="text-center">直接效应</TableHead>
                  <TableHead className="text-center">间接效应</TableHead>
                  <TableHead className="text-center">差异</TableHead>
                  <TableHead className="text-center">P值</TableHead>
                  <TableHead className="text-center">一致性</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {results.map((result, index) => (
                  <TableRow key={index}>
                    <TableCell className="font-medium">
                      {result.loop?.join(' vs ') || `比较 ${index + 1}`}
                    </TableCell>
                    <TableCell className="text-center font-mono">
                      {formatEffect(result.directEffect)}
                    </TableCell>
                    <TableCell className="text-center font-mono">
                      {formatEffect(result.indirectEffect)}
                    </TableCell>
                    <TableCell className="text-center font-mono">
                      {formatEffect(result.difference)}
                      <span className="text-xs text-slate-400 ml-1">
                        (SE: {result.differenceSe.toFixed(3)})
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      {formatPValue(result.consistencyPValue)}
                    </TableCell>
                    <TableCell className="text-center">
                      {result.isConsistent ? (
                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          一致
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                          <AlertCircle className="h-3 w-3 mr-1" />
                          不一致
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {/* 无结果提示 */}
        {results.length === 0 && (
          <div className="text-center py-8 text-slate-500">
            <p>无可用于一致性检验的数据</p>
            <p className="text-sm mt-1">需要同时存在直接证据和间接证据的比较才能进行检验</p>
          </div>
        )}

        {/* 方法说明 */}
        <div className="mt-4 p-3 bg-slate-50 rounded-lg text-sm">
          <p className="font-medium text-slate-700 mb-1">检验方法</p>
          <p className="text-slate-600 text-xs">
            使用 Bucher 方法比较直接效应量与间接效应量。
            当 P &lt; 0.05 时，认为存在不一致性，
            需进一步调查原因或考虑使用分离模型。
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * 简化版一致性指标卡
 */
export function ConsistencySummaryCard({
  consistentCount,
  totalCount,
}: {
  consistentCount: number;
  totalCount: number;
}) {
  const percentage = totalCount > 0 ? (consistentCount / totalCount) * 100 : 0;
  const isGood = percentage >= 80;

  return (
    <Card className="w-48">
      <CardContent className="pt-4">
        <div className="text-center">
          <div
            className={`text-3xl font-bold ${
              isGood ? 'text-green-600' : 'text-amber-600'
            }`}
          >
            {percentage.toFixed(0)}%
          </div>
          <p className="text-sm text-slate-500 mt-1">一致性比例</p>
          <div className="mt-2 flex justify-center gap-1">
            <Badge variant="outline" className="text-xs">
              {consistentCount}/{totalCount} 一致
            </Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
