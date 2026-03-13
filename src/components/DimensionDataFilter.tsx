'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Loader2,
  Filter,
  Layers,
  Database,
  Network,
  Sparkles,
  CheckCircle,
  AlertCircle,
  ArrowRight,
} from 'lucide-react';

interface ClassificationDimension {
  id: string;
  name: string;
  description?: string;
  categories: string[];
  dataAvailability?: string;
  contrastValue?: string;
}

interface ExtractedStudy {
  id: string;
  literature_id: string;
  study_name: string | null;
  sample_size_treatment: number | null;
  sample_size_treatment_name: string | null;
  sample_size_control: number | null;
  sample_size_control_name: string | null;
  events_treatment: number | null;
  events_treatment_name: string | null;
  events_control: number | null;
  events_control_name: string | null;
  outcome_type: string | null;
  subgroup: string | null;
  confidence: number | null;
  literature?: {
    id: string;
    title: string;
    authors?: string;
    year?: number;
  };
  classification?: {
    category: string;
    confidence: number;
  };
}

interface DimensionDataFilterProps {
  dimensions: ClassificationDimension[];
  extractedStudies: ExtractedStudy[];
  onFilterChange: (filteredStudies: ExtractedStudy[], dimensionId: string | null, category: string | null) => void;
  onCreateNetworkAnalysis?: (dimensionId: string, category: string, studies: ExtractedStudy[]) => void;
}

/**
 * 分类维度数据筛选组件
 * 支持按分类维度筛选数据，并可直接创建网状Meta分析
 */
export default function DimensionDataFilter({
  dimensions,
  extractedStudies,
  onFilterChange,
  onCreateNetworkAnalysis,
}: DimensionDataFilterProps) {
  const [selectedDimension, setSelectedDimension] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [filteredStudies, setFilteredStudies] = useState<ExtractedStudy[]>([]);
  const [loading, setLoading] = useState(false);
  const [showNetworkDialog, setShowNetworkDialog] = useState(false);
  const [networkConfig, setNetworkConfig] = useState({
    name: '',
    description: '',
    outcomeType: '',
    effectMeasure: '',
    modelType: 'random',
  });
  const [recommendation, setRecommendation] = useState<{
    outcomeType: string;
    effectMeasure: string;
    modelType: string;
    reasoning: string;
    confidence: number;
  } | null>(null);
  const [creating, setCreating] = useState(false);

  // 当维度或分类改变时，加载相关数据
  useEffect(() => {
    if (selectedDimension && selectedCategory) {
      loadDimensionData(selectedDimension, selectedCategory);
    } else {
      setFilteredStudies([]);
      onFilterChange([], null, null);
    }
  }, [selectedDimension, selectedCategory]);

  const loadDimensionData = async (dimensionId: string, category: string) => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/network-meta/dimension?action=dimension-data&dimensionId=${dimensionId}&category=${encodeURIComponent(category)}`
      );
      const data = await res.json();
      
      if (data.success) {
        // 关联分类信息和提取数据
        const studies: ExtractedStudy[] = data.data.extractedData.map((d: any) => {
          const classification = data.data.classifications.find(
            (c: any) => c.literature_id === d.literature_id
          );
          return {
            ...d,
            classification: classification ? {
              category: classification.category,
              confidence: classification.confidence,
            } : undefined,
          };
        });
        
        setFilteredStudies(studies);
        onFilterChange(studies, dimensionId, category);

        // 获取分析参数推荐
        if (studies.length > 0) {
          const studyIds = studies.map(s => s.id);
          const recRes = await fetch(
            `/api/network-meta/dimension?action=recommend-params&extractedDataIds=${studyIds.join(',')}`
          );
          const recData = await recRes.json();
          if (recData.success) {
            setRecommendation(recData.data);
            setNetworkConfig(prev => ({
              ...prev,
              outcomeType: recData.data.outcomeType,
              effectMeasure: recData.data.effectMeasure,
              modelType: recData.data.modelType,
            }));
          }
        }
      }
    } catch (error) {
      console.error('Load dimension data error:', error);
    } finally {
      setLoading(false);
    }
  };

  // 获取当前选中维度的信息
  const currentDimension = dimensions.find(d => d.id === selectedDimension);

  // 打开网状分析创建对话框
  const handleOpenNetworkDialog = () => {
    if (!currentDimension || !selectedCategory) return;
    
    setNetworkConfig(prev => ({
      ...prev,
      name: `${currentDimension.name} - ${selectedCategory}`,
      description: `基于"${currentDimension.name}"维度下"${selectedCategory}"分类的${filteredStudies.length}项研究`,
    }));
    setShowNetworkDialog(true);
  };

  // 创建网状Meta分析
  const handleCreateNetworkAnalysis = async () => {
    if (!selectedDimension || !selectedCategory) return;

    setCreating(true);
    try {
      const res = await fetch('/api/network-meta/dimension', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create-from-dimension',
          dimensionId: selectedDimension,
          category: selectedCategory,
          name: networkConfig.name,
          description: networkConfig.description,
          outcomeType: networkConfig.outcomeType,
          effectMeasure: networkConfig.effectMeasure,
          modelType: networkConfig.modelType,
        }),
      });
      
      const data = await res.json();
      if (data.success) {
        setShowNetworkDialog(false);
        if (onCreateNetworkAnalysis) {
          onCreateNetworkAnalysis(data.data.analysis.id, selectedCategory, filteredStudies);
        }
      } else {
        alert('创建失败: ' + data.error);
      }
    } catch (error) {
      console.error('Create network analysis error:', error);
      alert('创建失败');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* 维度选择器 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Layers className="h-4 w-4" />
            按分类维度筛选数据
          </CardTitle>
          <CardDescription>
            选择分类维度和具体分类，快速筛选相关研究数据
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            {/* 维度选择 */}
            <div className="w-[280px]">
              <Label className="text-sm text-slate-500 mb-1 block">分类维度</Label>
              <Select
                value={selectedDimension || ''}
                onValueChange={(v) => {
                  setSelectedDimension(v || null);
                  setSelectedCategory(null);
                  setFilteredStudies([]);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择分类维度" />
                </SelectTrigger>
                <SelectContent>
                  {dimensions.map((dim) => (
                    <SelectItem key={dim.id} value={dim.id}>
                      <div className="flex items-center justify-between w-full">
                        <span>{dim.name}</span>
                        <span className="text-xs text-slate-400 ml-2">
                          ({dim.categories.length}个分类)
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 分类选择 */}
            <div className="w-[280px]">
              <Label className="text-sm text-slate-500 mb-1 block">具体分类</Label>
              <Select
                value={selectedCategory || ''}
                onValueChange={(v) => setSelectedCategory(v || null)}
                disabled={!selectedDimension}
              >
                <SelectTrigger>
                  <SelectValue placeholder={selectedDimension ? "选择分类" : "请先选择维度"} />
                </SelectTrigger>
                <SelectContent>
                  {currentDimension?.categories.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 清除筛选 */}
            {(selectedDimension || selectedCategory) && (
              <div className="flex items-end">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSelectedDimension(null);
                    setSelectedCategory(null);
                    setFilteredStudies([]);
                  }}
                >
                  清除筛选
                </Button>
              </div>
            )}
          </div>

          {/* 维度信息展示 */}
          {currentDimension && (
            <div className="mt-4 p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
              <div className="text-sm">
                {currentDimension.description && (
                  <p className="text-slate-600 mb-1">{currentDimension.description}</p>
                )}
                {currentDimension.dataAvailability && (
                  <p className="text-xs text-slate-400">
                    数据可获得性: {currentDimension.dataAvailability}
                  </p>
                )}
                {currentDimension.contrastValue && (
                  <p className="text-xs text-blue-500">
                    对照值: {currentDimension.contrastValue}
                  </p>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 筛选结果 */}
      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
        </div>
      ) : selectedDimension && selectedCategory && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <Database className="h-4 w-4" />
                  筛选结果
                  <Badge variant="secondary">{filteredStudies.length} 条数据</Badge>
                </CardTitle>
                <CardDescription>
                  "{currentDimension?.name}" → {selectedCategory}
                </CardDescription>
              </div>
              {filteredStudies.length >= 2 && (
                <Button onClick={handleOpenNetworkDialog}>
                  <Network className="h-4 w-4 mr-2" />
                  创建网状Meta分析
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {filteredStudies.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                该分类下暂无数据
              </div>
            ) : (
              <>
                {/* AI推荐参数 */}
                {recommendation && (
                  <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                    <div className="flex items-start gap-2">
                      <Sparkles className="h-4 w-4 text-blue-500 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-blue-700 dark:text-blue-300">
                          AI推荐分析参数
                        </p>
                        <div className="flex flex-wrap gap-2 mt-2">
                          <Badge variant="outline" className="text-xs">
                            结局类型: {recommendation.outcomeType === 'dichotomous' ? '二分类' : '连续型'}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            效应量: {recommendation.effectMeasure}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            模型: {recommendation.modelType === 'random' ? '随机效应' : '固定效应'}
                          </Badge>
                        </div>
                        <p className="text-xs text-blue-600 dark:text-blue-400 mt-2">
                          {recommendation.reasoning}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* 数据表格 */}
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>研究名称</TableHead>
                        <TableHead>结局指标</TableHead>
                        <TableHead>样本量 (治疗/对照)</TableHead>
                        <TableHead>事件数 (治疗/对照)</TableHead>
                        <TableHead>干预措施</TableHead>
                        <TableHead>置信度</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredStudies.map((study) => (
                        <TableRow key={study.id}>
                          <TableCell className="font-medium">
                            <div>
                              {study.study_name || '未命名'}
                              {study.literature?.year && (
                                <span className="text-xs text-slate-400 ml-1">
                                  ({study.literature.year})
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="text-xs">
                              {study.outcome_type || '未分类'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {study.sample_size_treatment && study.sample_size_control ? (
                              <span className="font-mono text-sm">
                                {study.sample_size_treatment}/{study.sample_size_control}
                              </span>
                            ) : '-'}
                          </TableCell>
                          <TableCell>
                            {study.events_treatment !== null && study.events_control !== null ? (
                              <span className="font-mono text-sm">
                                {study.events_treatment}/{study.events_control}
                              </span>
                            ) : '-'}
                          </TableCell>
                          <TableCell>
                            <div className="text-xs space-y-1">
                              {study.sample_size_treatment_name && (
                                <div className="text-blue-600">
                                  治疗: {study.sample_size_treatment_name}
                                </div>
                              )}
                              {study.sample_size_control_name && (
                                <div className="text-green-600">
                                  对照: {study.sample_size_control_name}
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            {study.confidence !== null ? (
                              <Badge variant={study.confidence >= 0.8 ? 'default' : 'secondary'}>
                                {(study.confidence * 100).toFixed(0)}%
                              </Badge>
                            ) : '-'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* 快速操作 */}
                <div className="flex justify-end gap-2 mt-4 pt-4 border-t">
                  <Button variant="outline" onClick={handleOpenNetworkDialog}>
                    <Network className="h-4 w-4 mr-2" />
                    创建网状Meta分析
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* 创建网状Meta分析对话框 */}
      <Dialog open={showNetworkDialog} onOpenChange={setShowNetworkDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Network className="h-5 w-5" />
              创建网状Meta分析
            </DialogTitle>
            <DialogDescription>
              基于"{currentDimension?.name}"维度下"{selectedCategory}"分类的数据创建分析
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <Label>分析名称</Label>
              <Input
                value={networkConfig.name}
                onChange={(e) => setNetworkConfig({ ...networkConfig, name: e.target.value })}
              />
            </div>

            <div>
              <Label>描述</Label>
              <Input
                value={networkConfig.description}
                onChange={(e) => setNetworkConfig({ ...networkConfig, description: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>结局类型</Label>
                <Select
                  value={networkConfig.outcomeType}
                  onValueChange={(v) => setNetworkConfig({ ...networkConfig, outcomeType: v })}
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
                  value={networkConfig.effectMeasure}
                  onValueChange={(v) => setNetworkConfig({ ...networkConfig, effectMeasure: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="OR">比值比 (OR)</SelectItem>
                    <SelectItem value="RR">相对风险 (RR)</SelectItem>
                    <SelectItem value="SMD">标准化均差 (SMD)</SelectItem>
                    <SelectItem value="MD">均差 (MD)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>模型类型</Label>
              <Select
                value={networkConfig.modelType}
                onValueChange={(v) => setNetworkConfig({ ...networkConfig, modelType: v })}
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

            {/* AI推荐提示 */}
            {recommendation && (
              <div className="p-3 bg-slate-50 rounded-lg text-sm">
                <div className="flex items-center gap-2 text-slate-600">
                  <Sparkles className="h-4 w-4" />
                  <span>AI已根据数据特征自动推荐参数</span>
                  {recommendation.confidence >= 0.8 && (
                    <CheckCircle className="h-4 w-4 text-green-500 ml-auto" />
                  )}
                </div>
              </div>
            )}

            {/* 数据统计 */}
            <div className="p-3 bg-blue-50 rounded-lg text-sm">
              <p className="font-medium text-blue-700">分析数据预览</p>
              <div className="flex gap-4 mt-2 text-blue-600">
                <span>{filteredStudies.length} 项研究</span>
                <span>{new Set(filteredStudies.map(s => s.sample_size_treatment_name).filter(Boolean)).size} 种干预措施</span>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNetworkDialog(false)}>
              取消
            </Button>
            <Button onClick={handleCreateNetworkAnalysis} disabled={creating || !networkConfig.name}>
              {creating ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <ArrowRight className="h-4 w-4 mr-2" />
              )}
              创建分析
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
