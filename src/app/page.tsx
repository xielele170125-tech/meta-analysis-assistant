'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { FileText, Upload, Database, BarChart3, Settings, Loader2, Trash2, Eye, CheckCircle, XCircle, Clock, AlertCircle, Brain, FileUp } from 'lucide-react';

// 类型定义
interface Literature {
  id: string;
  title: string | null;
  authors: string | null;
  year: number | null;
  journal: string | null;
  file_name: string | null;
  status: string;
  error_message: string | null;
  created_at: string;
}

interface ExtractedStudy {
  id: string;
  literature_id: string;
  study_name: string | null;
  sample_size_treatment: number | null;
  sample_size_control: number | null;
  mean_treatment: number | null;
  mean_control: number | null;
  sd_treatment: number | null;
  sd_control: number | null;
  effect_size: number | null;
  standard_error: number | null;
  ci_lower: number | null;
  ci_upper: number | null;
  outcome_type: string | null;
  confidence: number | null;
}

interface MetaAnalysisResult {
  id: string;
  name: string;
  description: string | null;
  model_type: string;
  status: string;
  result?: {
    combined_effect: number;
    combined_ci_lower: number;
    combined_ci_upper: number;
    combined_p_value: number;
    heterogeneity_i2: number;
    forest_plot_data: Array<{
      id: string;
      studyName: string;
      effectSize: number;
      weight: number;
      ciLower: number;
      ciUpper: number;
    }>;
  };
}

export default function Home() {
  const [apiKey, setApiKey] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [activeTab, setActiveTab] = useState('literature');
  const [literature, setLiterature] = useState<Literature[]>([]);
  const [uploading, setUploading] = useState(false);
  const [extractedStudies, setExtractedStudies] = useState<ExtractedStudy[]>([]);
  const [selectedStudies, setSelectedStudies] = useState<Set<string>>(new Set());
  const [analyses, setAnalyses] = useState<MetaAnalysisResult[]>([]);
  const [creatingAnalysis, setCreatingAnalysis] = useState(false);
  const [analysisName, setAnalysisName] = useState('');
  const [analysisDescription, setAnalysisDescription] = useState('');
  const [modelType, setModelType] = useState('random');
  const [selectedLiterature, setSelectedLiterature] = useState<Literature | null>(null);

  useEffect(() => {
    const savedKey = localStorage.getItem('deepseek_api_key');
    if (savedKey) setApiKey(savedKey);
  }, []);

  const loadLiterature = useCallback(async () => {
    try {
      const res = await fetch('/api/literature');
      const data = await res.json();
      if (data.success) setLiterature(data.data);
    } catch (error) {
      console.error('Load literature error:', error);
    }
  }, []);

  const loadExtractedData = useCallback(async () => {
    try {
      const res = await fetch('/api/data');
      const data = await res.json();
      if (data.success) setExtractedStudies(data.data);
    } catch (error) {
      console.error('Load extracted data error:', error);
    }
  }, []);

  const loadAnalyses = useCallback(async () => {
    try {
      const res = await fetch('/api/analysis');
      const data = await res.json();
      if (data.success) setAnalyses(data.data);
    } catch (error) {
      console.error('Load analyses error:', error);
    }
  }, []);

  useEffect(() => {
    loadLiterature();
    loadExtractedData();
    loadAnalyses();
  }, [loadLiterature, loadExtractedData, loadAnalyses]);

  const saveApiKey = () => {
    if (apiKey.trim()) {
      localStorage.setItem('deepseek_api_key', apiKey);
      setShowSettings(false);
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !apiKey) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const uploadRes = await fetch('/api/literature/upload', { method: 'POST', body: formData });
      const uploadData = await uploadRes.json();
      if (!uploadData.success) throw new Error(uploadData.error);

      const createRes = await fetch('/api/literature', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: file.name.replace(/\.[^/.]+$/, ''),
          fileName: uploadData.data.fileName,
          fileKey: uploadData.data.fileKey,
        }),
      });
      const createData = await createRes.json();
      if (!createData.success) throw new Error(createData.error);

      const parseRes = await fetch('/api/literature/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileUrl: uploadData.data.fileUrl,
          literatureId: createData.data.id,
        }),
      });
      const parseData = await parseRes.json();
      if (!parseData.success) throw new Error(parseData.error);

      const extractRes = await fetch('/api/literature/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          literatureId: createData.data.id,
          content: parseData.data.content,
          apiKey: apiKey,
        }),
      });
      if (!extractRes.ok) {
        const errorData = await extractRes.json();
        throw new Error(errorData.error);
      }

      await loadLiterature();
      await loadExtractedData();
    } catch (error) {
      console.error('Upload error:', error);
      alert(error instanceof Error ? error.message : '上传失败');
    } finally {
      setUploading(false);
    }
  };

  const deleteLiterature = async (id: string) => {
    if (!confirm('确定要删除这篇文献吗？')) return;
    try {
      await fetch(`/api/literature?id=${id}`, { method: 'DELETE' });
      await loadLiterature();
      await loadExtractedData();
    } catch (error) {
      console.error('Delete error:', error);
    }
  };

  const toggleStudySelection = (id: string) => {
    const newSelected = new Set(selectedStudies);
    if (newSelected.has(id)) newSelected.delete(id);
    else newSelected.add(id);
    setSelectedStudies(newSelected);
  };

  const createAnalysis = async () => {
    if (selectedStudies.size < 2) {
      alert('请至少选择2项研究进行分析');
      return;
    }
    if (!analysisName.trim()) {
      alert('请输入分析名称');
      return;
    }

    setCreatingAnalysis(true);
    try {
      const res = await fetch('/api/analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: analysisName,
          description: analysisDescription,
          studyIds: Array.from(selectedStudies),
          modelType: modelType,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      setAnalysisName('');
      setAnalysisDescription('');
      setSelectedStudies(new Set());
      await loadAnalyses();
      setActiveTab('analysis');
    } catch (error) {
      console.error('Create analysis error:', error);
      alert(error instanceof Error ? error.message : '创建失败');
    } finally {
      setCreatingAnalysis(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'extracting': return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
      case 'failed': return <XCircle className="h-4 w-4 text-red-500" />;
      default: return <Clock className="h-4 w-4 text-yellow-500" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'completed': return '已完成';
      case 'extracting': return '提取中';
      case 'failed': return '失败';
      default: return '待处理';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      <header className="border-b bg-white/80 backdrop-blur-sm dark:bg-slate-900/80">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-lg">
              <FileText className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-white">Meta分析助手</h1>
              <p className="text-sm text-slate-500">文献数据提取与Meta分析工具</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {apiKey && (
              <Badge variant="outline" className="gap-1">
                <Brain className="h-3 w-3" /> DeepSeek 已配置
              </Badge>
            )}
            <Button variant="ghost" size="icon" onClick={() => setShowSettings(!showSettings)}>
              <Settings className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        {showSettings && (
          <Card className="mb-6">
            <CardHeader><CardTitle className="text-base">设置</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>DeepSeek API Key</Label>
                <div className="flex gap-2">
                  <Input type="password" placeholder="输入你的 DeepSeek API Key" value={apiKey} onChange={(e) => setApiKey(e.target.value)} />
                  <Button onClick={saveApiKey}>保存</Button>
                </div>
                <p className="text-xs text-slate-500">从 <a href="https://platform.deepseek.com" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">DeepSeek 平台</a> 获取</p>
              </div>
            </CardContent>
          </Card>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3 mb-6">
            <TabsTrigger value="literature" className="gap-2"><Upload className="h-4 w-4" /> 文献管理</TabsTrigger>
            <TabsTrigger value="data" className="gap-2"><Database className="h-4 w-4" /> 数据提取</TabsTrigger>
            <TabsTrigger value="analysis" className="gap-2"><BarChart3 className="h-4 w-4" /> Meta分析</TabsTrigger>
          </TabsList>

          <TabsContent value="literature">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div><CardTitle>文献列表</CardTitle><CardDescription>上传文献并自动提取数据</CardDescription></div>
                  <div>
                    <input type="file" id="file-upload" className="hidden" accept=".pdf,.doc,.docx" onChange={handleUpload} disabled={uploading || !apiKey} />
                    <Button asChild disabled={uploading || !apiKey}>
                      <label htmlFor="file-upload" className="cursor-pointer">
                        {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileUp className="mr-2 h-4 w-4" />}
                        {uploading ? '上传中...' : '上传文献'}
                      </label>
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {literature.length === 0 ? (
                  <div className="text-center py-12"><FileText className="mx-auto h-12 w-12 text-slate-300 mb-4" /><p className="text-slate-500">暂无文献，请上传PDF或Word文档</p></div>
                ) : (
                  <Table>
                    <TableHeader><TableRow><TableHead>状态</TableHead><TableHead>文献名称</TableHead><TableHead>年份</TableHead><TableHead>上传时间</TableHead><TableHead>操作</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {literature.map((lit) => (
                        <TableRow key={lit.id}>
                          <TableCell><div className="flex items-center gap-2">{getStatusIcon(lit.status)}<span className="text-sm">{getStatusText(lit.status)}</span></div></TableCell>
                          <TableCell className="font-medium">{lit.title || lit.file_name}</TableCell>
                          <TableCell>{lit.year || '-'}</TableCell>
                          <TableCell>{new Date(lit.created_at).toLocaleDateString()}</TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button variant="ghost" size="sm" onClick={() => setSelectedLiterature(lit)}><Eye className="h-4 w-4" /></Button>
                              <Button variant="ghost" size="sm" onClick={() => deleteLiterature(lit.id)}><Trash2 className="h-4 w-4 text-red-500" /></Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="data">
            <Card>
              <CardHeader><CardTitle>提取的数据</CardTitle><CardDescription>选择研究进行Meta分析</CardDescription></CardHeader>
              <CardContent>
                {extractedStudies.length === 0 ? (
                  <div className="text-center py-12"><Database className="mx-auto h-12 w-12 text-slate-300 mb-4" /><p className="text-slate-500">暂无数据，请先上传文献</p></div>
                ) : (
                  <div className="space-y-4">
                    <Table>
                      <TableHeader><TableRow><TableHead className="w-12">选择</TableHead><TableHead>研究名称</TableHead><TableHead>样本量(T/C)</TableHead><TableHead>效应量(SMD)</TableHead><TableHead>95% CI</TableHead><TableHead>置信度</TableHead></TableRow></TableHeader>
                      <TableBody>
                        {extractedStudies.map((study) => (
                          <TableRow key={study.id}>
                            <TableCell><input type="checkbox" checked={selectedStudies.has(study.id)} onChange={() => toggleStudySelection(study.id)} className="h-4 w-4" /></TableCell>
                            <TableCell className="font-medium">{study.study_name || '未命名'}</TableCell>
                            <TableCell>{study.sample_size_treatment && study.sample_size_control ? `${study.sample_size_treatment}/${study.sample_size_control}` : '-'}</TableCell>
                            <TableCell>{study.effect_size !== null ? study.effect_size.toFixed(3) : '-'}</TableCell>
                            <TableCell>{study.ci_lower !== null && study.ci_upper !== null ? `[${study.ci_lower.toFixed(3)}, ${study.ci_upper.toFixed(3)}]` : '-'}</TableCell>
                            <TableCell>{study.confidence !== null ? `${(study.confidence * 100).toFixed(0)}%` : '-'}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>

                    {selectedStudies.size >= 2 && (
                      <Card className="bg-slate-50 dark:bg-slate-800">
                        <CardHeader><CardTitle className="text-base">创建Meta分析</CardTitle></CardHeader>
                        <CardContent className="space-y-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2"><Label>分析名称</Label><Input value={analysisName} onChange={(e) => setAnalysisName(e.target.value)} placeholder="输入分析名称" /></div>
                            <div className="space-y-2"><Label>模型类型</Label>
                              <Select value={modelType} onValueChange={setModelType}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent><SelectItem value="random">随机效应模型</SelectItem><SelectItem value="fixed">固定效应模型</SelectItem></SelectContent>
                              </Select>
                            </div>
                          </div>
                          <div className="space-y-2"><Label>描述（可选）</Label><Textarea value={analysisDescription} onChange={(e) => setAnalysisDescription(e.target.value)} placeholder="描述本次分析的目的和方法" /></div>
                          <Button onClick={createAnalysis} disabled={creatingAnalysis || !analysisName.trim()}>
                            {creatingAnalysis ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <BarChart3 className="mr-2 h-4 w-4" />}
                            开始分析 ({selectedStudies.size}项研究)
                          </Button>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="analysis">
            <div className="grid gap-6">
              {analyses.length === 0 ? (
                <Card><CardContent className="text-center py-12"><BarChart3 className="mx-auto h-12 w-12 text-slate-300 mb-4" /><p className="text-slate-500">暂无分析结果，请先在数据提取页面创建分析</p></CardContent></Card>
              ) : (
                analyses.map((analysis) => (
                  <Card key={analysis.id}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div><CardTitle>{analysis.name}</CardTitle><CardDescription>{analysis.description}</CardDescription></div>
                        <Badge>{analysis.model_type === 'random' ? '随机效应' : '固定效应'}</Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {analysis.result && (
                        <div className="space-y-6">
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg"><p className="text-sm text-slate-500">合并效应量</p><p className="text-2xl font-bold">{analysis.result.combined_effect.toFixed(3)}</p></div>
                            <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg"><p className="text-sm text-slate-500">95% CI</p><p className="text-lg font-semibold">[{analysis.result.combined_ci_lower.toFixed(3)}, {analysis.result.combined_ci_upper.toFixed(3)}]</p></div>
                            <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg"><p className="text-sm text-slate-500">I² (异质性)</p><p className="text-2xl font-bold">{(analysis.result.heterogeneity_i2 * 100).toFixed(1)}%</p></div>
                            <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg"><p className="text-sm text-slate-500">P值</p><p className="text-2xl font-bold">{analysis.result.combined_p_value < 0.001 ? '<0.001' : analysis.result.combined_p_value.toFixed(3)}</p></div>
                          </div>
                          <div><h4 className="font-semibold mb-4">森林图</h4><ForestPlot data={analysis.result.forest_plot_data} /></div>
                          <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                            <h4 className="font-semibold mb-2 flex items-center gap-2"><AlertCircle className="h-4 w-4" /> 结果解释</h4>
                            <p className="text-sm text-slate-600 dark:text-slate-300">
                              {analysis.result.heterogeneity_i2 < 0.25 ? <>异质性较低 (I² = {(analysis.result.heterogeneity_i2 * 100).toFixed(1)}%)，研究间结果较为一致。</> : analysis.result.heterogeneity_i2 < 0.5 ? <>存在中等程度异质性 (I² = {(analysis.result.heterogeneity_i2 * 100).toFixed(1)}%)，建议探讨异质性来源。</> : <>异质性较高 (I² = {(analysis.result.heterogeneity_i2 * 100).toFixed(1)}%)，建议进行亚组分析或敏感性分析。</>}
                              {analysis.result.combined_p_value < 0.05 ? <>合并效应量具有统计学意义 (P = {analysis.result.combined_p_value.toFixed(3)})。</> : <>合并效应量无统计学意义 (P = {analysis.result.combined_p_value.toFixed(3)})。</>}
                            </p>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>
        </Tabs>
      </main>

      <Dialog open={!!selectedLiterature} onOpenChange={() => setSelectedLiterature(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>文献详情</DialogTitle></DialogHeader>
          {selectedLiterature && (
            <div className="space-y-4">
              <div><Label className="text-slate-500">标题</Label><p className="font-medium">{selectedLiterature.title || selectedLiterature.file_name}</p></div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label className="text-slate-500">作者</Label><p>{selectedLiterature.authors || '-'}</p></div>
                <div><Label className="text-slate-500">年份</Label><p>{selectedLiterature.year || '-'}</p></div>
              </div>
              {selectedLiterature.error_message && <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg"><Label className="text-red-600">错误信息</Label><p className="text-red-600">{selectedLiterature.error_message}</p></div>}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ForestPlot({ data }: { data: Array<{ id: string; studyName: string; effectSize: number; weight: number; ciLower: number; ciUpper: number }> }) {
  if (!data || data.length === 0) return null;
  const allValues = data.flatMap((d) => [d.ciLower, d.ciUpper]);
  const minVal = Math.min(...allValues, -1);
  const maxVal = Math.max(...allValues, 1);
  const range = maxVal - minVal;
  const avgEffect = data.reduce((sum, d) => sum + d.effectSize, 0) / data.length;
  const scale = (val: number) => ((val - minVal) / range) * 100;
  const effectToX = (effect: number) => scale(effect);

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[600px]">
        <div className="relative" style={{ height: 60 + data.length * 32 }}>
          <div className="absolute top-0 bottom-0 w-px bg-slate-300" style={{ left: `${effectToX(0)}%` }} />
          <div className="absolute top-0 bottom-0 w-0.5 bg-red-500 opacity-50" style={{ left: `${effectToX(avgEffect)}%` }} />
          {data.map((study, i) => {
            const left = effectToX(study.ciLower);
            const right = effectToX(study.ciUpper);
            const center = effectToX(study.effectSize);
            const size = Math.max(8, Math.min(24, study.weight / 2));
            return (
              <div key={study.id} className="absolute flex items-center" style={{ top: 20 + i * 32, height: 28 }}>
                <div className="w-40 text-sm text-right pr-4 truncate">{study.studyName}</div>
                <div className="relative flex-1 h-full">
                  <div className="absolute top-1/2 h-px bg-slate-600" style={{ left: `${left}%`, width: `${right - left}%` }} />
                  <div className="absolute top-1/2 -translate-y-1/2 rounded-full bg-blue-500 border-2 border-white shadow" style={{ left: `${center}%`, width: size, height: size, marginLeft: -size / 2 }} />
                </div>
                <div className="w-32 text-xs text-slate-500 text-right">[{study.ciLower.toFixed(2)}, {study.ciUpper.toFixed(2)}]</div>
              </div>
            );
          })}
        </div>
        <div className="flex justify-between text-xs text-slate-500 mt-2 px-40">
          <span>{minVal.toFixed(2)}</span><span>0 (无效应)</span><span>{maxVal.toFixed(2)}</span>
        </div>
      </div>
    </div>
  );
}
