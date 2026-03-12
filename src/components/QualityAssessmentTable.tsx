'use client';

import React, { useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CheckCircle2, AlertTriangle, XCircle, Download, Copy, Image, FileText, Star } from 'lucide-react';
import html2canvas from 'html2canvas';

// 类型定义
interface QualityDomain {
  name: string;
  judgment?: 'low' | 'some_concerns' | 'high';
  max_stars?: number;
  earned_stars?: number;
  questions?: Record<string, { question: string; answer: string; judgment?: string; stars?: number }>;
  reason?: string;
}

interface QualityAssessment {
  id: string;
  literature_id: string;
  scale_type: 'rob2' | 'nos' | 'quadas2';
  study_type?: string;
  total_score?: number;
  max_score?: number;
  domain_scores?: Record<string, QualityDomain>;
  overall_risk: 'low' | 'some_concerns' | 'high';
  reasoning?: string;
  confidence?: number;
  created_at: string;
  literature?: {
    id: string;
    title: string | null;
    authors: string | null;
    year: number | null;
  };
}

interface QualityAssessmentTableProps {
  assessments: QualityAssessment[];
  onExport?: (format: 'png' | 'word' | 'csv') => void;
}

// 风险颜色映射
const riskColors = {
  low: { bg: '#22c55e', text: 'white', label: '低风险', icon: CheckCircle2 },
  some_concerns: { bg: '#eab308', text: 'white', label: '有些担忧', icon: AlertTriangle },
  high: { bg: '#ef4444', text: 'white', label: '高风险', icon: XCircle },
};

// Cochrane RoB 2.0 域名称
const rob2Domains = [
  { key: 'D1', name: '随机化过程', fullName: 'Randomization process' },
  { key: 'D2', name: '偏离预期干预', fullName: 'Deviations from intended interventions' },
  { key: 'D3', name: '结局数据缺失', fullName: 'Missing outcome data' },
  { key: 'D4', name: '结局测量', fullName: 'Measurement of the outcome' },
  { key: 'D5', name: '选择性报告', fullName: 'Selection of the reported result' },
];

// Newcastle-Ottawa 条目
const nosItems = {
  selection: [
    { key: 'S1', name: '暴露队列的代表性' },
    { key: 'S2', name: '非暴露队列的选择' },
    { key: 'S3', name: '暴露的确定' },
    { key: 'S4', name: '结局未发生' },
  ],
  comparability: [
    { key: 'C1', name: '控制混杂因素' },
  ],
  outcome: [
    { key: 'O1', name: '结局评估' },
    { key: 'O2', name: '随访时间' },
    { key: 'O3', name: '随访完整性' },
  ],
};

export default function QualityAssessmentTable({ assessments }: QualityAssessmentTableProps) {
  const tableRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);
  const [selectedScale, setSelectedScale] = useState<'rob2' | 'nos' | 'all'>('all');

  // 过滤评估数据
  const filteredAssessments = selectedScale === 'all' 
    ? assessments 
    : assessments.filter(a => a.scale_type === selectedScale);

  // 导出为PNG图片
  const exportToPNG = async () => {
    if (!tableRef.current) return;
    
    setExporting(true);
    try {
      const canvas = await html2canvas(tableRef.current, {
        backgroundColor: '#ffffff',
        scale: 2,
        useCORS: true,
      });
      
      const link = document.createElement('a');
      link.download = `quality-assessment-${new Date().toISOString().split('T')[0]}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (error) {
      console.error('Export to PNG error:', error);
      alert('导出图片失败');
    } finally {
      setExporting(false);
    }
  };

  // 复制为Word格式（HTML表格）
  const copyToWord = () => {
    if (!tableRef.current) return;
    
    try {
      const html = tableRef.current.innerHTML;
      
      // 创建一个包含HTML的blob
      const blob = new Blob([`
        <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; font-size: 11pt; }
            table { border-collapse: collapse; width: 100%; }
            th, td { border: 1px solid black; padding: 6px; text-align: center; }
            th { background-color: #f0f0f0; font-weight: bold; }
            .risk-low { background-color: #22c55e; color: white; }
            .risk-some { background-color: #eab308; color: white; }
            .risk-high { background-color: #ef4444; color: white; }
            .star { color: #f59e0b; }
          </style>
        </head>
        <body>
          <h2>质量评估表</h2>
          ${html}
        </body>
        </html>
      `], { type: 'application/msword' });
      
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `quality-assessment-${new Date().toISOString().split('T')[0]}.doc`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Copy to Word error:', error);
      alert('导出Word失败');
    }
  };

  // 渲染风险单元格
  const renderRiskCell = (judgment?: 'low' | 'some_concerns' | 'high') => {
    if (!judgment) return <span className="text-slate-300">-</span>;
    
    const config = riskColors[judgment];
    const Icon = config.icon;
    
    return (
      <div 
        className="flex items-center justify-center gap-1 px-2 py-1 rounded text-xs font-medium"
        style={{ backgroundColor: config.bg, color: config.text }}
      >
        <Icon className="h-3 w-3" />
        {config.label}
      </div>
    );
  };

  // 渲染星号
  const renderStars = (earned: number, max: number) => {
    return (
      <div className="flex items-center justify-center gap-0.5">
        {Array.from({ length: max }).map((_, i) => (
          <Star 
            key={i} 
            className={`h-4 w-4 ${i < earned ? 'text-yellow-500 fill-yellow-500' : 'text-slate-200'}`} 
          />
        ))}
      </div>
    );
  };

  // 获取研究名称
  const getStudyName = (assessment: QualityAssessment) => {
    if (assessment.literature) {
      const authors = assessment.literature.authors?.split(',')[0] || '';
      const year = assessment.literature.year || '';
      return `${authors} ${year}`.trim() || '未命名';
    }
    return `研究 ${assessment.literature_id.slice(0, 8)}`;
  };

  if (assessments.length === 0) {
    return (
      <Card className="p-8">
        <div className="text-center text-slate-500">
          <FileText className="h-12 w-12 mx-auto mb-4 text-slate-300" />
          <p>暂无质量评分数据</p>
          <p className="text-sm mt-2">请先对文献进行质量评分</p>
        </div>
      </Card>
    );
  }

  const rob2Assessments = assessments.filter(a => a.scale_type === 'rob2');
  const nosAssessments = assessments.filter(a => a.scale_type === 'nos');

  return (
    <div className="space-y-6">
      {/* 工具栏 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Select value={selectedScale} onValueChange={(v) => setSelectedScale(v as any)}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="选择量表类型" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部量表</SelectItem>
              <SelectItem value="rob2">Cochrane RoB 2.0</SelectItem>
              <SelectItem value="nos">Newcastle-Ottawa</SelectItem>
            </SelectContent>
          </Select>
          <div className="text-sm text-slate-500">
            共 {filteredAssessments.length} 篇研究的质量评估
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={exportToPNG} disabled={exporting}>
            <Image className="h-4 w-4 mr-1" />
            {exporting ? '导出中...' : '导出图片'}
          </Button>
          <Button variant="outline" size="sm" onClick={copyToWord}>
            <FileText className="h-4 w-4 mr-1" />
            导出Word
          </Button>
        </div>
      </div>

      {/* 导出区域 */}
      <div ref={tableRef} className="space-y-8 bg-white p-6 rounded-lg">
        {/* Cochrane RoB 2.0 偏倚风险汇总表 */}
        {rob2Assessments.length > 0 && (selectedScale === 'all' || selectedScale === 'rob2') && (
          <div>
            <h3 className="text-lg font-bold mb-4 text-center">
              Table. Risk of bias assessment using Cochrane Risk of Bias tool (RoB 2.0)
            </h3>
            
            <Table className="border-collapse border border-slate-300">
              <TableHeader>
                <TableRow className="bg-slate-100">
                  <TableHead className="border border-slate-300 text-center font-bold w-[150px]">
                    Study
                  </TableHead>
                  <TableHead className="border border-slate-300 text-center font-bold">
                    D1<br/><span className="text-xs font-normal">Randomization</span>
                  </TableHead>
                  <TableHead className="border border-slate-300 text-center font-bold">
                    D2<br/><span className="text-xs font-normal">Deviations</span>
                  </TableHead>
                  <TableHead className="border border-slate-300 text-center font-bold">
                    D3<br/><span className="text-xs font-normal">Missing data</span>
                  </TableHead>
                  <TableHead className="border border-slate-300 text-center font-bold">
                    D4<br/><span className="text-xs font-normal">Measurement</span>
                  </TableHead>
                  <TableHead className="border border-slate-300 text-center font-bold">
                    D5<br/><span className="text-xs font-normal">Reporting</span>
                  </TableHead>
                  <TableHead className="border border-slate-300 text-center font-bold">
                    Overall
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rob2Assessments.map((assessment) => (
                  <TableRow key={assessment.id}>
                    <TableCell className="border border-slate-300 font-medium text-left">
                      {getStudyName(assessment)}
                    </TableCell>
                    {rob2Domains.map((domain) => (
                      <TableCell key={domain.key} className="border border-slate-300 text-center p-1">
                        {renderRiskCell(assessment.domain_scores?.[domain.key]?.judgment as any)}
                      </TableCell>
                    ))}
                    <TableCell className="border border-slate-300 text-center p-1">
                      {renderRiskCell(assessment.overall_risk)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {/* 图例 */}
            <div className="flex items-center justify-center gap-6 mt-4 text-sm">
              <div className="flex items-center gap-1">
                <div className="w-4 h-4 rounded bg-green-500"></div>
                <span>Low risk of bias</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-4 h-4 rounded bg-yellow-500"></div>
                <span>Some concerns</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-4 h-4 rounded bg-red-500"></div>
                <span>High risk of bias</span>
              </div>
            </div>

            <p className="text-xs text-slate-500 mt-4 text-center">
              D1: Randomization process; D2: Deviations from intended interventions; 
              D3: Missing outcome data; D4: Measurement of the outcome; D5: Selection of the reported result
            </p>
          </div>
        )}

        {/* Newcastle-Ottawa 量表表格 */}
        {nosAssessments.length > 0 && (selectedScale === 'all' || selectedScale === 'nos') && (
          <div>
            <h3 className="text-lg font-bold mb-4 text-center">
              Table. Quality assessment using Newcastle-Ottawa Scale (NOS)
            </h3>
            
            <Table className="border-collapse border border-slate-300">
              <TableHeader>
                <TableRow className="bg-slate-100">
                  <TableHead className="border border-slate-300 text-center font-bold w-[120px]" rowSpan={2}>
                    Study
                  </TableHead>
                  <TableHead className="border border-slate-300 text-center font-bold" colSpan={4}>
                    Selection (max 4 ★)
                  </TableHead>
                  <TableHead className="border border-slate-300 text-center font-bold" colSpan={1}>
                    Comparability (max 2 ★)
                  </TableHead>
                  <TableHead className="border border-slate-300 text-center font-bold" colSpan={3}>
                    Outcome (max 3 ★)
                  </TableHead>
                  <TableHead className="border border-slate-300 text-center font-bold" rowSpan={2}>
                    Total<br/>(max 9 ★)
                  </TableHead>
                </TableRow>
                <TableRow className="bg-slate-50">
                  {/* Selection */}
                  <TableHead className="border border-slate-300 text-center text-xs">S1</TableHead>
                  <TableHead className="border border-slate-300 text-center text-xs">S2</TableHead>
                  <TableHead className="border border-slate-300 text-center text-xs">S3</TableHead>
                  <TableHead className="border border-slate-300 text-center text-xs">S4</TableHead>
                  {/* Comparability */}
                  <TableHead className="border border-slate-300 text-center text-xs">C1</TableHead>
                  {/* Outcome */}
                  <TableHead className="border border-slate-300 text-center text-xs">O1</TableHead>
                  <TableHead className="border border-slate-300 text-center text-xs">O2</TableHead>
                  <TableHead className="border border-slate-300 text-center text-xs">O3</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {nosAssessments.map((assessment) => {
                  const selection = assessment.domain_scores?.selection;
                  const comparability = assessment.domain_scores?.comparability;
                  const outcome = assessment.domain_scores?.outcome;
                  
                  return (
                    <TableRow key={assessment.id}>
                      <TableCell className="border border-slate-300 font-medium text-left">
                        {getStudyName(assessment)}
                      </TableCell>
                      {/* Selection S1-S4 */}
                      {nosItems.selection.map((item) => {
                        const q = selection?.questions?.[item.key];
                        return (
                          <TableCell key={item.key} className="border border-slate-300 text-center">
                            {q?.stars ? <span className="text-yellow-500">★</span> : <span className="text-slate-300">-</span>}
                          </TableCell>
                        );
                      })}
                      {/* Comparability C1 (can be 0-2 stars) */}
                      <TableCell className="border border-slate-300 text-center">
                        {comparability?.questions?.C1?.stars ? (
                          <span className="text-yellow-500">{'★'.repeat(comparability.questions.C1.stars)}</span>
                        ) : <span className="text-slate-300">-</span>}
                      </TableCell>
                      {/* Outcome O1-O3 */}
                      {nosItems.outcome.map((item) => {
                        const q = outcome?.questions?.[item.key];
                        return (
                          <TableCell key={item.key} className="border border-slate-300 text-center">
                            {q?.stars ? <span className="text-yellow-500">★</span> : <span className="text-slate-300">-</span>}
                          </TableCell>
                        );
                      })}
                      {/* Total */}
                      <TableCell className="border border-slate-300 text-center font-bold">
                        {assessment.total_score !== null ? (
                          <span className="text-yellow-500">
                            {assessment.total_score}/9 ★
                          </span>
                        ) : '-'}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>

            {/* 说明 */}
            <div className="mt-4 text-xs text-slate-600 space-y-1">
              <p><strong>S1:</strong> Representativeness of the exposed cohort</p>
              <p><strong>S2:</strong> Selection of the non-exposed cohort</p>
              <p><strong>S3:</strong> Ascertainment of exposure</p>
              <p><strong>S4:</strong> Outcome of interest was not present at start of study</p>
              <p><strong>C1:</strong> Comparability of cohorts on the basis of the design or analysis</p>
              <p><strong>O1:</strong> Assessment of outcome; <strong>O2:</strong> Follow-up long enough; <strong>O3:</strong> Adequacy of follow-up</p>
              <p className="mt-2"><strong>Quality grading:</strong> ★★★★★★★★★ (9 stars) = High quality; ★★★★★★-★★★ (6-8 stars) = Moderate quality; ≤5 stars = Low quality</p>
            </div>
          </div>
        )}

        {/* 页脚 */}
        <div className="text-center text-xs text-slate-400 mt-6 pt-4 border-t">
          Generated by Meta Analysis AI System | {new Date().toLocaleDateString()}
        </div>
      </div>
    </div>
  );
}
