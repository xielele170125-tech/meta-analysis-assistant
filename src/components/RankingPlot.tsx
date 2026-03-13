'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface TreatmentRanking {
  intervention: string;
  sucra: number;
  meanRank: number;
  rankProbabilities: number[];
  numberOfStudies: number;
}

interface RankingPlotProps {
  rankings: TreatmentRanking[];
  effectMeasure?: string;
  showProbabilities?: boolean;
}

/**
 * 治疗排名图组件
 * 展示SUCRA排名和排名概率分布
 */
export default function RankingPlot({
  rankings,
  effectMeasure = 'OR',
  showProbabilities = true,
}: RankingPlotProps) {
  // 排序后的排名数据
  const sortedRankings = [...rankings].sort((a, b) => b.sucra - a.sucra);

  // 颜色映射
  const getSucraColor = (sucra: number) => {
    if (sucra >= 0.8) return 'bg-green-500';
    if (sucra >= 0.6) return 'bg-green-400';
    if (sucra >= 0.4) return 'bg-yellow-500';
    if (sucra >= 0.2) return 'bg-orange-500';
    return 'bg-red-500';
  };

  const getSucraTextColor = (sucra: number) => {
    if (sucra >= 0.6) return 'text-green-700';
    if (sucra >= 0.4) return 'text-yellow-700';
    return 'text-orange-700';
  };

  // 计算排名概率条的颜色
  const getRankColor = (rank: number, total: number) => {
    // 排名越靠前颜色越深
    const ratio = 1 - rank / (total + 1);
    const hue = 142; // 绿色
    const saturation = 70;
    const lightness = 90 - ratio * 40;
    return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
          </svg>
          治疗效果排名 (SUCRA)
        </CardTitle>
        <CardDescription>
          SUCRA值越大，治疗效果越好
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* SUCRA排名条形图 */}
        <div className="space-y-3 mb-6">
          {sortedRankings.map((ranking, index) => (
            <div key={ranking.intervention} className="space-y-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold">
                    {index + 1}
                  </span>
                  <span className="font-medium">{ranking.intervention}</span>
                  {index === 0 && (
                    <Badge variant="default" className="bg-yellow-500 text-xs">
                      最佳
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-bold ${getSucraTextColor(ranking.sucra)}`}>
                    {(ranking.sucra * 100).toFixed(1)}%
                  </span>
                  <span className="text-xs text-slate-400">
                    (n={ranking.numberOfStudies})
                  </span>
                </div>
              </div>
              
              {/* 进度条 */}
              <div className="relative h-6 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className={`absolute left-0 top-0 h-full ${getSucraColor(ranking.sucra)} transition-all duration-500`}
                  style={{ width: `${ranking.sucra * 100}%` }}
                />
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-xs font-medium text-slate-700">
                    SUCRA: {(ranking.sucra * 100).toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* 排名概率分布热图 */}
        {showProbabilities && sortedRankings.length > 0 && sortedRankings[0].rankProbabilities && (
          <div className="border rounded-lg p-4 bg-slate-50">
            <h4 className="text-sm font-medium mb-3">排名概率分布</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th className="text-left py-1 px-2 font-medium">干预</th>
                    {sortedRankings[0].rankProbabilities.map((_, rankIdx) => (
                      <th key={rankIdx} className="text-center py-1 px-2 font-medium">
                        第{rankIdx + 1}名
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sortedRankings.map((ranking) => (
                    <tr key={ranking.intervention}>
                      <td className="py-1 px-2 font-medium">{ranking.intervention}</td>
                      {ranking.rankProbabilities.map((prob, rankIdx) => (
                        <td key={rankIdx} className="py-1 px-1">
                          <div
                            className="h-6 rounded flex items-center justify-center text-xs font-medium"
                            style={{
                              backgroundColor: getRankColor(rankIdx, ranking.rankProbabilities.length),
                              color: prob > 0.3 ? 'white' : '#374151',
                            }}
                          >
                            {(prob * 100).toFixed(0)}%
                          </div>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-slate-500 mt-2">
              颜色越深表示该干预措施获得该排名的概率越高
            </p>
          </div>
        )}

        {/* 排名解读 */}
        <div className="mt-4 p-3 bg-blue-50 rounded-lg text-sm">
          <p className="font-medium text-blue-800 mb-1">SUCRA 解读</p>
          <ul className="text-blue-700 space-y-1 text-xs">
            <li>• SUCRA = 100%: 该干预确定排名第一</li>
            <li>• SUCRA = 50%: 该干预排名居中</li>
            <li>• SUCRA = 0%: 该干预确定排名最后</li>
            <li>• SUCRA ≥ 70% 通常被认为是较好的治疗选择</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * 排名图简略版本（仅显示柱状图）
 */
export function SimpleRankingBar({
  rankings,
  width = 300,
  height = 200,
}: {
  rankings: TreatmentRanking[];
  width?: number;
  height?: number;
}) {
  const sorted = [...rankings].sort((a, b) => b.sucra - a.sucra);
  const barHeight = height / sorted.length - 10;
  const maxBarWidth = width - 120;

  return (
    <svg width={width} height={height}>
      {sorted.map((ranking, index) => {
        const y = index * (barHeight + 10) + 5;
        const barWidth = ranking.sucra * maxBarWidth;

        return (
          <g key={ranking.intervention}>
            {/* 标签 */}
            <text x="0" y={y + barHeight / 2 + 4} fontSize="11" fill="#374151">
              {ranking.intervention.length > 8
                ? ranking.intervention.substring(0, 8) + '...'
                : ranking.intervention}
            </text>

            {/* 背景条 */}
            <rect x="80" y={y} width={maxBarWidth} height={barHeight} fill="#f1f5f9" rx="4" />

            {/* 进度条 */}
            <rect
              x="80"
              y={y}
              width={barWidth}
              height={barHeight}
              fill={ranking.sucra >= 0.5 ? '#22c55e' : '#f59e0b'}
              rx="4"
            />

            {/* 百分比 */}
            <text x={90 + barWidth} y={y + barHeight / 2 + 4} fontSize="10" fill="#374151">
              {(ranking.sucra * 100).toFixed(0)}%
            </text>
          </g>
        );
      })}
    </svg>
  );
}
