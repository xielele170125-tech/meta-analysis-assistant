'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Loader2,
  Network,
  Plus,
  Trash2,
  Play,
  ChevronDown,
  ChevronUp,
  GitCompare,
  BarChart3,
  AlertTriangle,
  CheckCircle,
  Info,
} from 'lucide-react';
import NetworkPlot from './NetworkPlot';
import RankingPlot from './RankingPlot';
import LeagueTable, { SimpleLeagueTable } from './LeagueTable';
import ConsistencyReport, { ConsistencySummaryCard } from './ConsistencyReport';

// 类型定义
interface Intervention {
  id: string;
  name: string;
  description?: string;
  is_reference?: boolean;
}

interface NetworkComparison {
  id: string;
  intervention_a_id: string;
  intervention_b_id: string;
  intervention_a?: Intervention;
  intervention_b?: Intervention;
  study_count: number;
  total_sample_a: number;
  total_sample_b: number;
  total_events_a: number;
  total_events_b: number;
  direct_effect: number;
  direct_se: number;
  direct_ci_lower: number;
  direct_ci_upper: number;
  direct_p_value: number;
}

interface SUCRAResult {
  intervention_id: string;
  intervention?: Intervention;
  sucra: number;
  rank_probability: number[];
  mean_rank: number;
  median_rank: number;
}

interface NetworkMetaAnalysis {
  id: string;
  name: string;
  description?: string;
  outcome_type: string;
  effect_measure: string;
  model_type: string;
  status: string;
  created_at: string;
}

interface NetworkAnalysisResult {
  analysis: NetworkMetaAnalysis;
  interventions: Intervention[];
  comparisons: NetworkComparison[];
  sucraResults: SUCRAResult[];
  leagueTable?: Array<{
    intervention: string;
    comparisons: Array<{
      vs: string;
      effectSize: number;
      ciLower: number;
      ciUpper: number;
      pValue: number;
      isSignificant: boolean;
    }>;
  }>;
  consistencyResults?: Array<{
    testMethod: string;
    loop?: string[];
    directEffect: number;
    indirectEffect: number;
    difference: number;
    differenceSe: number;
    consistencyPValue: number;
    isConsistent: boolean;
    conclusion: string;
  }>;
  networkStructure?: {
    nodeCount: number;
    edgeCount: number;
    density: number;
    hasClosedLoops: boolean;
    connectedComponents: string[][];
  };
}

interface NetworkAnalysisTabProps {
  apiKey: string;
  extractedStudies: Array<{
    id: string;
    literature_id: string;
    sample_size_treatment: number | null;
    sample_size_treatment_name: string | null;
    sample_size_control: number | null;
    sample_size_control_name: string | null;
    events_treatment: number | null;
    events_treatment_name: string | null;
    events_control: number | null;
    events_control_name: string | null;
    outcome_type: string | null;
    study_name: string | null;
  }>;
}

export default function NetworkAnalysisTab({
  apiKey,
  extractedStudies,
}: NetworkAnalysisTabProps) {
  // 状态
  const [analyses, setAnalyses] = useState<NetworkMetaAnalysis[]>([]);
  const [selectedAnalysis, setSelectedAnalysis] = useState<NetworkAnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [addingData, setAddingData] = useState(false);
  const [calculating, setCalculating] = useState(false);

  // 创建分析表单
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    outcomeType: 'dichotomous',
    effectMeasure: 'OR',
    modelType: 'random',
  });

  // 添加干预措施表单
  const [newIntervention, setNewIntervention] = useState({ name: '', description: '' });
  const [interventions, setInterventions] = useState<Intervention[]>([]);
  const [showAddIntervention, setShowAddIntervention] = useState(false);

  // 添加比较数据表单
  const [comparisonData, setComparisonData] = useState({
    interventionA: '',
    interventionB: '',
    studyCount: 1,
    sampleA: 0,
    sampleB: 0,
    eventsA: 0,
    eventsB: 0,
  });
  const [showAddComparison, setShowAddComparison] = useState(false);

  // 加载分析列表
  const loadAnalyses = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/network-meta');
      const data = await res.json();
      if (data.success) {
        setAnalyses(data.data);
      }
    } catch (error) {
      console.error('Load analyses error:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAnalyses();
  }, [loadAnalyses]);

  // 创建分析
  const handleCreate = async () => {
    if (!formData.name) {
      alert('请输入分析名称');
      return;
    }

    setCreating(true);
    try {
      const res = await fetch('/api/network-meta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          ...formData,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setShowCreateDialog(false);
        setFormData({
          name: '',
          description: '',
          outcomeType: 'dichotomous',
          effectMeasure: 'OR',
          modelType: 'random',
        });
        loadAnalyses();
      } else {
        alert('创建失败: ' + data.error);
      }
    } catch (error) {
      console.error('Create error:', error);
      alert('创建失败');
    } finally {
      setCreating(false);
    }
  };

  // 加载分析详情
  const loadAnalysisDetail = async (analysisId: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/network-meta?analysisId=${analysisId}`);
      const data = await res.json();
      if (data.success) {
        setSelectedAnalysis(data.data);
        setInterventions(data.data.interventions || []);
      }
    } catch (error) {
      console.error('Load detail error:', error);
    } finally {
      setLoading(false);
    }
  };

  // 添加干预措施
  const handleAddIntervention = async () => {
    if (!selectedAnalysis || !newIntervention.name) {
      alert('请输入干预措施名称');
      return;
    }

    setAddingData(true);
    try {
      const res = await fetch('/api/network-meta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'add_intervention',
          analysisId: selectedAnalysis.analysis.id,
          ...newIntervention,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setNewIntervention({ name: '', description: '' });
        loadAnalysisDetail(selectedAnalysis.analysis.id);
      } else {
        alert('添加失败: ' + data.error);
      }
    } catch (error) {
      console.error('Add intervention error:', error);
      alert('添加失败');
    } finally {
      setAddingData(false);
    }
  };

  // 添加比较数据
  const handleAddComparison = async () => {
    if (!selectedAnalysis || !comparisonData.interventionA || !comparisonData.interventionB) {
      alert('请选择两个干预措施');
      return;
    }

    setAddingData(true);
    try {
      const res = await fetch('/api/network-meta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'add_comparison',
          analysisId: selectedAnalysis.analysis.id,
          ...comparisonData,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setComparisonData({
          interventionA: '',
          interventionB: '',
          studyCount: 1,
          sampleA: 0,
          sampleB: 0,
          eventsA: 0,
          eventsB: 0,
        });
        loadAnalysisDetail(selectedAnalysis.analysis.id);
      } else {
        alert('添加失败: ' + data.error);
      }
    } catch (error) {
      console.error('Add comparison error:', error);
      alert('添加失败');
    } finally {
      setAddingData(false);
    }
  };

  // 执行计算
  const handleCalculate = async () => {
    if (!selectedAnalysis) return;

    setCalculating(true);
    try {
      const res = await fetch('/api/network-meta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'calculate',
          analysisId: selectedAnalysis.analysis.id,
        }),
      });
      const data = await res.json();
      if (data.success) {
        loadAnalysisDetail(selectedAnalysis.analysis.id);
      } else {
        alert('计算失败: ' + data.error);
      }
    } catch (error) {
      console.error('Calculate error:', error);
      alert('计算失败');
    } finally {
      setCalculating(false);
    }
  };

  // 删除分析
  const handleDelete = async (analysisId: string) => {
    if (!confirm('确定要删除此分析吗？')) return;

    try {
      const res = await fetch('/api/network-meta', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ analysisId }),
      });
      const data = await res.json();
      if (data.success) {
        loadAnalyses();
        if (selectedAnalysis?.analysis.id === analysisId) {
          setSelectedAnalysis(null);
        }
      }
    } catch (error) {
      console.error('Delete error:', error);
    }
  };

  return (
    <div className="space-y-6">
      {/* 顶部操作栏 */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">网状Meta分析</h2>
          <p className="text-slate-500 text-sm">
            支持多臂试验、间接比较、SUCRA排名、一致性检验
          </p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          新建分析
        </Button>
      </div>

      {/* 分析列表 */}
      {loading && !selectedAnalysis ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
        </div>
      ) : selectedAnalysis ? (
        <NetworkAnalysisDetail
          result={selectedAnalysis}
          interventions={interventions}
          onBack={() => setSelectedAnalysis(null)}
          onAddIntervention={showAddIntervention}
          setShowAddIntervention={setShowAddIntervention}
          newIntervention={newIntervention}
          setNewIntervention={setNewIntervention}
          handleAddIntervention={handleAddIntervention}
          addingData={addingData}
          onAddComparison={showAddComparison}
          setShowAddComparison={setShowAddComparison}
          comparisonData={comparisonData}
          setComparisonData={setComparisonData}
          handleAddComparison={handleAddComparison}
          onCalculate={handleCalculate}
          calculating={calculating}
        />
      ) : (
        <div className="grid gap-4">
          {analyses.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12">
                <Network className="h-12 w-12 mx-auto text-slate-300 mb-4" />
                <p className="text-slate-500">暂无网状Meta分析</p>
                <p className="text-sm text-slate-400 mt-1">
                  点击"新建分析"开始创建
                </p>
              </CardContent>
            </Card>
          ) : (
            analyses.map((analysis) => (
              <Card
                key={analysis.id}
                className="cursor-pointer hover:border-primary transition-colors"
              >
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div onClick={() => loadAnalysisDetail(analysis.id)} className="flex-1">
                      <CardTitle>{analysis.name}</CardTitle>
                      <CardDescription>{analysis.description}</CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">
                        {analysis.effect_measure}
                      </Badge>
                      <Badge>
                        {analysis.model_type === 'random' ? '随机效应' : '固定效应'}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(analysis.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent onClick={() => loadAnalysisDetail(analysis.id)}>
                  <div className="flex gap-4 text-sm text-slate-500">
                    <span>结局类型: {analysis.outcome_type === 'dichotomous' ? '二分类' : '连续型'}</span>
                    <span>创建于: {new Date(analysis.created_at).toLocaleDateString()}</span>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}

      {/* 创建分析对话框 */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>创建网状Meta分析</DialogTitle>
            <DialogDescription>
              配置分析参数，添加干预措施后进行网状Meta分析
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>分析名称 *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="如：抗抑郁药物疗效比较"
              />
            </div>
            <div>
              <Label>描述</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="分析目的和背景..."
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>结局类型</Label>
                <Select
                  value={formData.outcomeType}
                  onValueChange={(v) => setFormData({ ...formData, outcomeType: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="dichotomous">二分类变量</SelectItem>
                    <SelectItem value="continuous">连续型变量</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>效应量</Label>
                <Select
                  value={formData.effectMeasure}
                  onValueChange={(v) => setFormData({ ...formData, effectMeasure: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="OR">比值比 (OR)</SelectItem>
                    <SelectItem value="RR">相对风险 (RR)</SelectItem>
                    <SelectItem value="RD">风险差 (RD)</SelectItem>
                    <SelectItem value="SMD">标准化均差 (SMD)</SelectItem>
                    <SelectItem value="MD">均差 (MD)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>模型类型</Label>
              <Select
                value={formData.modelType}
                onValueChange={(v) => setFormData({ ...formData, modelType: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="random">随机效应模型</SelectItem>
                  <SelectItem value="fixed">固定效应模型</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              取消
            </Button>
            <Button onClick={handleCreate} disabled={creating}>
              {creating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              创建
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// 网状分析详情组件
function NetworkAnalysisDetail({
  result,
  interventions,
  onBack,
  onAddIntervention,
  setShowAddIntervention,
  newIntervention,
  setNewIntervention,
  handleAddIntervention,
  addingData,
  onAddComparison,
  setShowAddComparison,
  comparisonData,
  setComparisonData,
  handleAddComparison,
  onCalculate,
  calculating,
}: {
  result: NetworkAnalysisResult;
  interventions: Intervention[];
  onBack: () => void;
  onAddIntervention: boolean;
  setShowAddIntervention: (v: boolean) => void;
  newIntervention: { name: string; description: string };
  setNewIntervention: (v: { name: string; description: string }) => void;
  handleAddIntervention: () => void;
  addingData: boolean;
  onAddComparison: boolean;
  setShowAddComparison: (v: boolean) => void;
  comparisonData: {
    interventionA: string;
    interventionB: string;
    studyCount: number;
    sampleA: number;
    sampleB: number;
    eventsA: number;
    eventsB: number;
  };
  setComparisonData: (v: typeof comparisonData) => void;
  handleAddComparison: () => void;
  onCalculate: () => void;
  calculating: boolean;
}) {
  const [activeTab, setActiveTab] = useState('overview');

  const { analysis, comparisons, sucraResults, leagueTable, consistencyResults, networkStructure } = result;

  return (
    <div className="space-y-6">
      {/* 返回按钮和标题 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={onBack}>
            <ChevronDown className="h-4 w-4 mr-1 rotate-90" />
            返回
          </Button>
          <div>
            <h3 className="text-xl font-bold">{analysis.name}</h3>
            <p className="text-sm text-slate-500">{analysis.description}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline">{analysis.effect_measure}</Badge>
          <Badge>{analysis.model_type === 'random' ? '随机效应' : '固定效应'}</Badge>
        </div>
      </div>

      {/* 操作按钮 */}
      <div className="flex gap-2">
        <Button variant="outline" onClick={() => setShowAddIntervention(true)}>
          <Plus className="h-4 w-4 mr-2" />
          添加干预措施
        </Button>
        <Button
          variant="outline"
          onClick={() => setShowAddComparison(true)}
          disabled={interventions.length < 2}
        >
          <GitCompare className="h-4 w-4 mr-2" />
          添加比较数据
        </Button>
        <Button
          onClick={onCalculate}
          disabled={calculating || comparisons.length < 2}
        >
          {calculating ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Play className="h-4 w-4 mr-2" />
          )}
          执行分析
        </Button>
      </div>

      {/* Tab内容 */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">概览</TabsTrigger>
          <TabsTrigger value="network">网状图</TabsTrigger>
          <TabsTrigger value="ranking">排名</TabsTrigger>
          <TabsTrigger value="league">联盟表</TabsTrigger>
          <TabsTrigger value="consistency">一致性检验</TabsTrigger>
        </TabsList>

        {/* 概览 */}
        <TabsContent value="overview">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-4">
                <div className="text-2xl font-bold">{interventions.length}</div>
                <p className="text-sm text-slate-500">干预措施</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="text-2xl font-bold">{comparisons.length}</div>
                <p className="text-sm text-slate-500">比较对</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="text-2xl font-bold">
                  {networkStructure?.density.toFixed(2) || '-'}
                </div>
                <p className="text-sm text-slate-500">网络密度</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2">
                  {networkStructure?.hasClosedLoops ? (
                    <>
                      <CheckCircle className="h-5 w-5 text-green-500" />
                      <span className="text-green-600">存在闭合环</span>
                    </>
                  ) : (
                    <>
                      <Info className="h-5 w-5 text-blue-500" />
                      <span className="text-blue-600">星型网络</span>
                    </>
                  )}
                </div>
                <p className="text-sm text-slate-500 mt-1">网络结构</p>
              </CardContent>
            </Card>
          </div>

          {/* 干预措施列表 */}
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>干预措施</CardTitle>
            </CardHeader>
            <CardContent>
              {interventions.length === 0 ? (
                <p className="text-center text-slate-500 py-4">
                  点击"添加干预措施"添加治疗选项
                </p>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {interventions.map((int) => (
                    <div
                      key={int.id}
                      className="p-3 border rounded-lg flex items-center justify-between"
                    >
                      <div>
                        <span className="font-medium">{int.name}</span>
                        {int.is_reference && (
                          <Badge variant="secondary" className="ml-2 text-xs">
                            参照
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* 比较数据列表 */}
          <Card className="mt-4">
            <CardHeader>
              <CardTitle>比较数据</CardTitle>
            </CardHeader>
            <CardContent>
              {comparisons.length === 0 ? (
                <p className="text-center text-slate-500 py-4">
                  点击"添加比较数据"输入研究结果
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>比较对</TableHead>
                      <TableHead className="text-center">研究数</TableHead>
                      <TableHead className="text-center">样本量</TableHead>
                      <TableHead className="text-center">事件数</TableHead>
                      <TableHead className="text-center">效应量</TableHead>
                      <TableHead className="text-center">95% CI</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {comparisons.map((comp) => (
                      <TableRow key={comp.id}>
                        <TableCell>
                          {comp.intervention_a?.name} vs {comp.intervention_b?.name}
                        </TableCell>
                        <TableCell className="text-center">{comp.study_count}</TableCell>
                        <TableCell className="text-center">
                          {comp.total_sample_a} / {comp.total_sample_b}
                        </TableCell>
                        <TableCell className="text-center">
                          {comp.total_events_a} / {comp.total_events_b}
                        </TableCell>
                        <TableCell className="text-center font-mono">
                          {comp.direct_effect ? Math.exp(comp.direct_effect).toFixed(2) : '-'}
                        </TableCell>
                        <TableCell className="text-center font-mono text-xs">
                          {comp.direct_ci_lower
                            ? `[${Math.exp(comp.direct_ci_lower).toFixed(2)}, ${Math.exp(comp.direct_ci_upper).toFixed(2)}]`
                            : '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 网状图 */}
        <TabsContent value="network">
          {comparisons.length < 2 ? (
            <Card>
              <CardContent className="text-center py-12">
                <Network className="h-12 w-12 mx-auto text-slate-300 mb-4" />
                <p className="text-slate-500">需要至少2个比较对才能生成网状图</p>
              </CardContent>
            </Card>
          ) : (
            <NetworkPlot
              nodes={interventions.map((i) => ({
                id: i.id,
                name: i.name,
                numberOfStudies: comparisons.filter(
                  (c) => c.intervention_a_id === i.id || c.intervention_b_id === i.id
                ).length,
                sampleSize: comparisons
                  .filter((c) => c.intervention_a_id === i.id || c.intervention_b_id === i.id)
                  .reduce((sum, c) => sum + c.total_sample_a + c.total_sample_b, 0),
              }))}
              edges={comparisons.map((c) => ({
                source: c.intervention_a_id,
                target: c.intervention_b_id,
                numberOfStudies: c.study_count,
                totalSampleSize: c.total_sample_a + c.total_sample_b,
                effectSize: c.direct_effect,
                ciLower: c.direct_ci_lower,
                ciUpper: c.direct_ci_upper,
              }))}
              effectMeasure={analysis.effect_measure}
            />
          )}
        </TabsContent>

        {/* 排名 */}
        <TabsContent value="ranking">
          {sucraResults.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12">
                <BarChart3 className="h-12 w-12 mx-auto text-slate-300 mb-4" />
                <p className="text-slate-500">点击"执行分析"计算SUCRA排名</p>
              </CardContent>
            </Card>
          ) : (
            <RankingPlot
              rankings={sucraResults.map((r) => ({
                intervention: r.intervention?.name || r.intervention_id,
                sucra: r.sucra,
                meanRank: r.mean_rank,
                rankProbabilities: r.rank_probability,
                numberOfStudies: comparisons.filter(
                  (c) => c.intervention_a_id === r.intervention_id || c.intervention_b_id === r.intervention_id
                ).length,
              }))}
              effectMeasure={analysis.effect_measure}
            />
          )}
        </TabsContent>

        {/* 联盟表 */}
        <TabsContent value="league">
          {!leagueTable || leagueTable.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12">
                <GitCompare className="h-12 w-12 mx-auto text-slate-300 mb-4" />
                <p className="text-slate-500">点击"执行分析"生成联盟表</p>
              </CardContent>
            </Card>
          ) : (
            <LeagueTable
              interventions={interventions.map((i) => i.name)}
              table={leagueTable}
              effectMeasure={analysis.effect_measure}
            />
          )}
        </TabsContent>

        {/* 一致性检验 */}
        <TabsContent value="consistency">
          {!consistencyResults || consistencyResults.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12">
                <AlertTriangle className="h-12 w-12 mx-auto text-slate-300 mb-4" />
                <p className="text-slate-500">
                  需要存在闭合环（同时有直接和间接证据）才能进行一致性检验
                </p>
              </CardContent>
            </Card>
          ) : (
            <ConsistencyReport
              results={consistencyResults}
              effectMeasure={analysis.effect_measure}
            />
          )}
        </TabsContent>
      </Tabs>

      {/* 添加干预措施对话框 */}
      <Dialog open={onAddIntervention} onOpenChange={setShowAddIntervention}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>添加干预措施</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>干预措施名称 *</Label>
              <Input
                value={newIntervention.name}
                onChange={(e) =>
                  setNewIntervention({ ...newIntervention, name: e.target.value })
                }
                placeholder="如：安慰剂、药物A、药物B"
              />
            </div>
            <div>
              <Label>描述</Label>
              <Input
                value={newIntervention.description}
                onChange={(e) =>
                  setNewIntervention({ ...newIntervention, description: e.target.value })
                }
                placeholder="剂量、疗程等信息"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddIntervention(false)}>
              取消
            </Button>
            <Button onClick={handleAddIntervention} disabled={addingData}>
              {addingData && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              添加
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 添加比较数据对话框 */}
      <Dialog open={onAddComparison} onOpenChange={setShowAddComparison}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>添加比较数据</DialogTitle>
            <DialogDescription>
              输入两个干预措施直接比较的研究结果
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>干预措施 A</Label>
                <Select
                  value={comparisonData.interventionA}
                  onValueChange={(v) =>
                    setComparisonData({ ...comparisonData, interventionA: v })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="选择" />
                  </SelectTrigger>
                  <SelectContent>
                    {interventions.map((i) => (
                      <SelectItem key={i.id} value={i.id}>
                        {i.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>干预措施 B</Label>
                <Select
                  value={comparisonData.interventionB}
                  onValueChange={(v) =>
                    setComparisonData({ ...comparisonData, interventionB: v })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="选择" />
                  </SelectTrigger>
                  <SelectContent>
                    {interventions.map((i) => (
                      <SelectItem key={i.id} value={i.id}>
                        {i.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>研究数量</Label>
              <Input
                type="number"
                min={1}
                value={comparisonData.studyCount}
                onChange={(e) =>
                  setComparisonData({
                    ...comparisonData,
                    studyCount: parseInt(e.target.value) || 1,
                  })
                }
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>干预A样本量</Label>
                <Input
                  type="number"
                  value={comparisonData.sampleA}
                  onChange={(e) =>
                    setComparisonData({
                      ...comparisonData,
                      sampleA: parseInt(e.target.value) || 0,
                    })
                  }
                />
              </div>
              <div>
                <Label>干预B样本量</Label>
                <Input
                  type="number"
                  value={comparisonData.sampleB}
                  onChange={(e) =>
                    setComparisonData({
                      ...comparisonData,
                      sampleB: parseInt(e.target.value) || 0,
                    })
                  }
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>干预A事件数</Label>
                <Input
                  type="number"
                  value={comparisonData.eventsA}
                  onChange={(e) =>
                    setComparisonData({
                      ...comparisonData,
                      eventsA: parseInt(e.target.value) || 0,
                    })
                  }
                />
              </div>
              <div>
                <Label>干预B事件数</Label>
                <Input
                  type="number"
                  value={comparisonData.eventsB}
                  onChange={(e) =>
                    setComparisonData({
                      ...comparisonData,
                      eventsB: parseInt(e.target.value) || 0,
                    })
                  }
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddComparison(false)}>
              取消
            </Button>
            <Button onClick={handleAddComparison} disabled={addingData}>
              {addingData && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              添加
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
