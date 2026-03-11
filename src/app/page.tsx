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
  DialogDescription,
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
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { FileText, Upload, Database, BarChart3, Settings, Loader2, Trash2, Eye, CheckCircle, XCircle, Clock, AlertCircle, Brain, FileUp, Download, FileSpreadsheet, Code2, TriangleAlert, TrendingUp } from 'lucide-react';

// 类型定义
interface Literature {
  id: string;
  title: string | null;
  authors: string | null;
  year: number | null;
  journal: string | null;
  doi: string | null;
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

interface ImportResultRecord {
  title: string;
  doi: string | null;
  status: 'imported' | 'no_pdf' | 'failed';
  message: string;
  literatureId?: string;
}

interface ImportResult {
  total: number;
  imported: number;
  withPdf: number;
  withoutPdf: number;
  failed: number;
  records: ImportResultRecord[];
}

interface FunnelPlotData {
  studyId: string;
  studyName: string;
  effectSize: number;
  se: number;
  weight: number;
}

interface FunnelPlotResult {
  studies: FunnelPlotData[];
  pooledEffect: number;
  pooledSe: number;
  pooledCI: [number, number];
  asymmetryTest: {
    egger: {
      intercept: number;
      se: number;
      pValue: number;
    };
    begg: {
      tau: number;
      pValue: number;
    };
  };
  trimFill?: {
    missingStudies: number;
    adjustedEffect: number;
    adjustedCI: [number, number];
  };
  heterogeneity: {
    q: number;
    qPValue: number;
    i2: number;
    tau2: number;
  };
}

interface RCodeResult {
  rCode: string;
  studyCount: number;
  analysisName: string;
  modelType: string;
}

export default function Home() {
  const [apiKey, setApiKey] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [activeTab, setActiveTab] = useState('literature');
  const [literature, setLiterature] = useState<Literature[]>([]);
  const [uploading, setUploading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [showImportResult, setShowImportResult] = useState(false);
  const [autoDownloadPdf, setAutoDownloadPdf] = useState(true);
  const [extractedStudies, setExtractedStudies] = useState<ExtractedStudy[]>([]);
  const [selectedStudies, setSelectedStudies] = useState<string[]>([]);
  const [analyses, setAnalyses] = useState<MetaAnalysisResult[]>([]);
  const [creatingAnalysis, setCreatingAnalysis] = useState(false);
  const [analysisName, setAnalysisName] = useState('');
  const [analysisDescription, setAnalysisDescription] = useState('');
  const [modelType, setModelType] = useState('random');
  const [selectedLiterature, setSelectedLiterature] = useState<Literature | null>(null);
  const [funnelPlotData, setFunnelPlotData] = useState<Record<string, FunnelPlotResult>>({});
  const [showRCode, setShowRCode] = useState(false);
  const [rCodeData, setRCodeData] = useState<RCodeResult | null>(null);
  const [loadingFunnelPlot, setLoadingFunnelPlot] = useState<string | null>(null);
  const [exportingExcel, setExportingExcel] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
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

  // 上传单个PDF文献
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

  // 导入EndNote文件
  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('autoDownloadPdf', autoDownloadPdf.toString());

      const res = await fetch('/api/literature/import', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();

      if (!data.success) {
        throw new Error(data.error);
      }

      setImportResult(data.data);
      setShowImportResult(true);
      await loadLiterature();

      // 如果有带PDF的文献，自动提取数据
      if (apiKey && data.data.withPdf > 0) {
        const importedWithPdf = data.data.records.filter(
          (r: ImportResultRecord) => r.status === 'imported' && r.literatureId
        );
        
        for (const record of importedWithPdf) {
          try {
            // 获取文献详情
            const litRes = await fetch(`/api/literature?id=${record.literatureId}`);
            const litData = await litRes.json();
            
            if (litData.success && litData.data.file_key) {
              // 解析PDF
              const parseRes = await fetch('/api/literature/parse', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  fileKey: litData.data.file_key,
                  literatureId: record.literatureId,
                }),
              });
              const parseData = await parseRes.json();
              
              if (parseData.success) {
                // 提取数据
                await fetch('/api/literature/extract', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    literatureId: record.literatureId,
                    content: parseData.data.content,
                    apiKey: apiKey,
                  }),
                });
              }
            }
          } catch {
            // 忽略单个文献的错误
          }
        }
        await loadExtractedData();
      }
    } catch (error) {
      console.error('Import error:', error);
      alert(error instanceof Error ? error.message : '导入失败');
    } finally {
      setImporting(false);
      // 重置文件输入
      e.target.value = '';
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
    setSelectedStudies(prev => 
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    );
  };

  const createAnalysis = async () => {
    if (selectedStudies.length < 2) {
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
          studyIds: selectedStudies,
          modelType: modelType,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      setAnalysisName('');
      setAnalysisDescription('');
      setSelectedStudies([]);
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

  // 导出Excel
  const exportExcel = async (analysisId?: string) => {
    setExportingExcel(true);
    try {
      const url = analysisId 
        ? `/api/export/excel?analysisId=${analysisId}`
        : '/api/export/excel';
      
      const res = await fetch(url);
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || '导出失败');
      }
      
      const blob = await res.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = 'meta_analysis_data.xlsx';
      a.click();
      window.URL.revokeObjectURL(downloadUrl);
    } catch (error) {
      alert(error instanceof Error ? error.message : '导出失败');
    } finally {
      setExportingExcel(false);
    }
  };

  // 生成R代码
  const generateRCode = async (analysisId: string) => {
    try {
      const res = await fetch(`/api/export/r-code?analysisId=${analysisId}`);
      const data = await res.json();
      
      if (!data.success) {
        throw new Error(data.error || '生成失败');
      }
      
      setRCodeData(data.data);
      setShowRCode(true);
    } catch (error) {
      alert(error instanceof Error ? error.message : '生成R代码失败');
    }
  };

  // 加载漏斗图数据
  const loadFunnelPlot = async (analysisId: string) => {
    setLoadingFunnelPlot(analysisId);
    try {
      const res = await fetch(`/api/analysis/funnel-plot?analysisId=${analysisId}`);
      const data = await res.json();
      
      if (!data.success) {
        throw new Error(data.error || '获取漏斗图数据失败');
      }
      
      setFunnelPlotData(prev => ({ ...prev, [analysisId]: data.data }));
    } catch (error) {
      console.error('Load funnel plot error:', error);
      alert(error instanceof Error ? error.message : '获取漏斗图数据失败');
    } finally {
      setLoadingFunnelPlot(null);
    }
  };

  // 复制R代码到剪贴板
  const copyRCode = async () => {
    if (rCodeData?.rCode) {
      await navigator.clipboard.writeText(rCodeData.rCode);
      alert('R代码已复制到剪贴板');
    }
  };

  // 在客户端挂载前不渲染内容，避免 hydration 错误
  // 注意：这个检查必须在所有 hooks 定义之后
  if (!mounted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
        <div className="container mx-auto px-4 py-6 flex items-center justify-center min-h-[50vh]">
          <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
        </div>
      </div>
    );
  }

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
                  <div><CardTitle>文献列表</CardTitle><CardDescription>上传文献或导入EndNote文件</CardDescription></div>
                  <div className="flex items-center gap-2">
                    {/* 导入EndNote按钮 */}
                    <div className="flex items-center gap-2 mr-2">
                      <Checkbox id="auto-pdf" checked={autoDownloadPdf} onCheckedChange={(checked) => setAutoDownloadPdf(checked as boolean)} />
                      <label htmlFor="auto-pdf" className="text-sm text-slate-600 cursor-pointer">自动下载PDF</label>
                    </div>
                    <input type="file" id="import-file" className="hidden" accept=".ris,.txt,.xml" onChange={handleImport} disabled={importing} />
                    <Button variant="outline" asChild disabled={importing}>
                      <label htmlFor="import-file" className="cursor-pointer">
                        {importing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileSpreadsheet className="mr-2 h-4 w-4" />}
                        {importing ? '导入中...' : '导入EndNote'}
                      </label>
                    </Button>
                    {/* 上传PDF按钮 */}
                    <input type="file" id="file-upload" className="hidden" accept=".pdf,.doc,.docx" onChange={handleUpload} disabled={uploading || !apiKey} />
                    <Button asChild disabled={uploading || !apiKey}>
                      <label htmlFor="file-upload" className="cursor-pointer">
                        {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileUp className="mr-2 h-4 w-4" />}
                        {uploading ? '上传中...' : '上传PDF'}
                      </label>
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {literature.length === 0 ? (
                  <div className="text-center py-12">
                    <FileText className="mx-auto h-12 w-12 text-slate-300 mb-4" />
                    <p className="text-slate-500 mb-2">暂无文献</p>
                    <p className="text-sm text-slate-400">上传PDF或导入EndNote文件（RIS/XML格式）</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>状态</TableHead>
                        <TableHead>文献名称</TableHead>
                        <TableHead>作者</TableHead>
                        <TableHead>年份</TableHead>
                        <TableHead>期刊</TableHead>
                        <TableHead>PDF</TableHead>
                        <TableHead>操作</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {literature.map((lit) => (
                        <TableRow key={lit.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {getStatusIcon(lit.status)}
                              <span className="text-sm">{getStatusText(lit.status)}</span>
                            </div>
                          </TableCell>
                          <TableCell className="font-medium max-w-xs truncate" title={lit.title || ''}>
                            {lit.title || '未命名'}
                          </TableCell>
                          <TableCell className="max-w-xs truncate" title={lit.authors || ''}>
                            {lit.authors || '-'}
                          </TableCell>
                          <TableCell>{lit.year || '-'}</TableCell>
                          <TableCell className="max-w-xs truncate" title={lit.journal || ''}>
                            {lit.journal || '-'}
                          </TableCell>
                          <TableCell>
                            {lit.file_name ? (
                              <Badge variant="secondary" className="gap-1">
                                <FileText className="h-3 w-3" /> 已上传
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-slate-400">无PDF</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button variant="ghost" size="sm" onClick={() => setSelectedLiterature(lit)}>
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="sm" onClick={() => deleteLiterature(lit.id)}>
                                <Trash2 className="h-4 w-4 text-red-500" />
                              </Button>
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
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>提取的数据</CardTitle>
                    <CardDescription>选择研究进行Meta分析</CardDescription>
                  </div>
                  {extractedStudies.length > 0 && (
                    <Button variant="outline" size="sm" onClick={() => exportExcel()} disabled={exportingExcel}>
                      {exportingExcel ? (
                        <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                      ) : (
                        <FileSpreadsheet className="h-4 w-4 mr-1" />
                      )}
                      导出Excel
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {extractedStudies.length === 0 ? (
                  <div className="text-center py-12">
                    <Database className="mx-auto h-12 w-12 text-slate-300 mb-4" />
                    <p className="text-slate-500">暂无数据，请先上传文献</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-12">选择</TableHead>
                          <TableHead>研究名称</TableHead>
                          <TableHead>样本量(T/C)</TableHead>
                          <TableHead>效应量(SMD)</TableHead>
                          <TableHead>95% CI</TableHead>
                          <TableHead>置信度</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {extractedStudies.map((study) => (
                          <TableRow key={study.id}>
                            <TableCell>
                              <input type="checkbox" checked={selectedStudies.includes(study.id)} onChange={() => toggleStudySelection(study.id)} className="h-4 w-4" />
                            </TableCell>
                            <TableCell className="font-medium">{study.study_name || '未命名'}</TableCell>
                            <TableCell>{study.sample_size_treatment && study.sample_size_control ? `${study.sample_size_treatment}/${study.sample_size_control}` : '-'}</TableCell>
                            <TableCell>{study.effect_size !== null ? study.effect_size.toFixed(3) : '-'}</TableCell>
                            <TableCell>{study.ci_lower !== null && study.ci_upper !== null ? `[${study.ci_lower.toFixed(3)}, ${study.ci_upper.toFixed(3)}]` : '-'}</TableCell>
                            <TableCell>{study.confidence !== null ? `${(study.confidence * 100).toFixed(0)}%` : '-'}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>

                    {selectedStudies.length >= 2 && (
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
                            开始分析 ({selectedStudies.length}项研究)
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
                        <div className="flex items-center gap-2">
                          <Badge>{analysis.model_type === 'random' ? '随机效应' : '固定效应'}</Badge>
                          <Button variant="outline" size="sm" onClick={() => exportExcel(analysis.id)} disabled={exportingExcel}>
                            <FileSpreadsheet className="h-4 w-4 mr-1" /> 导出Excel
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => generateRCode(analysis.id)}>
                            <Code2 className="h-4 w-4 mr-1" /> R代码
                          </Button>
                        </div>
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
                          
                          {/* 漏斗图 */}
                          <div>
                            <div className="flex items-center justify-between mb-4">
                              <h4 className="font-semibold flex items-center gap-2">
                                <TrendingUp className="h-4 w-4" />
                                漏斗图 (发表偏倚检验)
                              </h4>
                              {!funnelPlotData[analysis.id] && (
                                <Button 
                                  variant="outline" 
                                  size="sm" 
                                  onClick={() => loadFunnelPlot(analysis.id)}
                                  disabled={loadingFunnelPlot === analysis.id}
                                >
                                  {loadingFunnelPlot === analysis.id ? (
                                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                                  ) : (
                                    <TrendingUp className="h-4 w-4 mr-1" />
                                  )}
                                  生成漏斗图
                                </Button>
                              )}
                            </div>
                            
                            {funnelPlotData[analysis.id] && (
                              <FunnelPlotDisplay data={funnelPlotData[analysis.id]} />
                            )}
                          </div>
                          
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

      {/* 文献详情弹窗 */}
      <Dialog open={!!selectedLiterature} onOpenChange={() => setSelectedLiterature(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>文献详情</DialogTitle></DialogHeader>
          {selectedLiterature && (
            <div className="space-y-4">
              <div><Label className="text-slate-500">标题</Label><p className="font-medium">{selectedLiterature.title || '未命名'}</p></div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label className="text-slate-500">作者</Label><p>{selectedLiterature.authors || '-'}</p></div>
                <div><Label className="text-slate-500">年份</Label><p>{selectedLiterature.year || '-'}</p></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label className="text-slate-500">期刊</Label><p>{selectedLiterature.journal || '-'}</p></div>
                <div><Label className="text-slate-500">DOI</Label><p className="truncate">{selectedLiterature.doi || '-'}</p></div>
              </div>
              {selectedLiterature.error_message && <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg"><Label className="text-red-600">错误信息</Label><p className="text-red-600">{selectedLiterature.error_message}</p></div>}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* 导入结果弹窗 */}
      <Dialog open={showImportResult} onOpenChange={setShowImportResult}>
        <DialogContent className="max-w-3xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>导入结果</DialogTitle>
            <DialogDescription>
              共导入 {importResult?.imported} / {importResult?.total} 篇文献
            </DialogDescription>
          </DialogHeader>
          {importResult && (
            <div className="space-y-4">
              <div className="grid grid-cols-4 gap-4">
                <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg text-center">
                  <p className="text-2xl font-bold text-green-600">{importResult.imported}</p>
                  <p className="text-sm text-slate-500">成功导入</p>
                </div>
                <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-center">
                  <p className="text-2xl font-bold text-blue-600">{importResult.withPdf}</p>
                  <p className="text-sm text-slate-500">已下载PDF</p>
                </div>
                <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg text-center">
                  <p className="text-2xl font-bold text-yellow-600">{importResult.withoutPdf}</p>
                  <p className="text-sm text-slate-500">无PDF</p>
                </div>
                <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg text-center">
                  <p className="text-2xl font-bold text-red-600">{importResult.failed}</p>
                  <p className="text-sm text-slate-500">导入失败</p>
                </div>
              </div>
              <ScrollArea className="h-[300px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>状态</TableHead>
                      <TableHead>文献</TableHead>
                      <TableHead>DOI</TableHead>
                      <TableHead>说明</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {importResult.records.map((record, i) => (
                      <TableRow key={i}>
                        <TableCell>
                          {record.status === 'imported' && <Badge className="bg-green-500">已导入</Badge>}
                          {record.status === 'no_pdf' && <Badge variant="secondary">无PDF</Badge>}
                          {record.status === 'failed' && <Badge variant="destructive">失败</Badge>}
                        </TableCell>
                        <TableCell className="max-w-xs truncate">{record.title}</TableCell>
                        <TableCell className="max-w-xs truncate">{record.doi || '-'}</TableCell>
                        <TableCell className="text-sm text-slate-500">{record.message}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* R代码弹窗 */}
      <Dialog open={showRCode} onOpenChange={setShowRCode}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Code2 className="h-5 w-5" />
              R语言Meta分析代码
            </DialogTitle>
            <DialogDescription>
              将以下代码复制到RStudio中运行，生成森林图和漏斗图
            </DialogDescription>
          </DialogHeader>
          {rCodeData && (
            <div className="space-y-4">
              <div className="flex items-center justify-between text-sm text-slate-500">
                <span>研究数量: {rCodeData.studyCount}</span>
                <span>模型类型: {rCodeData.modelType === 'random' ? '随机效应模型' : '固定效应模型'}</span>
              </div>
              <div className="flex justify-end">
                <Button variant="outline" size="sm" onClick={copyRCode}>
                  <Download className="h-4 w-4 mr-1" /> 复制代码
                </Button>
              </div>
              <ScrollArea className="h-[400px]">
                <pre className="text-xs bg-slate-100 dark:bg-slate-800 p-4 rounded-lg overflow-x-auto whitespace-pre-wrap font-mono">
                  {rCodeData.rCode}
                </pre>
              </ScrollArea>
              <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  <strong>使用说明:</strong> 请确保已安装 R 和必要的包 (meta, metafor, ggplot2)。首次运行时会自动安装缺失的包。
                </p>
              </div>
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

// 漏斗图组件
function FunnelPlotDisplay({ data }: { data: FunnelPlotResult }) {
  const { studies, pooledEffect, asymmetryTest, heterogeneity } = data;
  
  // 计算图形范围
  const allEffects = studies.map(s => s.effectSize);
  const minEffect = Math.min(...allEffects, pooledEffect - 0.5);
  const maxEffect = Math.max(...allEffects, pooledEffect + 0.5);
  const maxSe = Math.max(...studies.map(s => s.se));
  
  // SVG尺寸
  const width = 600;
  const height = 400;
  const margin = { top: 40, right: 40, bottom: 50, left: 60 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;
  
  // 坐标转换
  const xScale = (effect: number) => margin.left + ((effect - minEffect) / (maxEffect - minEffect)) * plotWidth;
  const yScale = (se: number) => margin.top + (se / maxSe) * plotHeight;
  
  // 计算漏斗形状的边界
  const funnelPoints = [];
  for (let se = 0; se <= maxSe; se += maxSe / 20) {
    const ci = 1.96 * se;
    funnelPoints.push({
      left: { x: xScale(pooledEffect - ci), y: yScale(se) },
      right: { x: xScale(pooledEffect + ci), y: yScale(se) },
    });
  }
  
  // 判断是否存在发表偏倚
  const hasBias = asymmetryTest.egger.pValue < 0.1 || asymmetryTest.begg.pValue < 0.1;
  
  return (
    <div className="space-y-4">
      <div className="flex justify-center overflow-x-auto">
        <svg width={width} height={height} className="border rounded-lg bg-white">
          {/* 背景网格 */}
          <defs>
            <pattern id="grid" width="50" height="50" patternUnits="userSpaceOnUse">
              <path d="M 50 0 L 0 0 0 50" fill="none" stroke="#e5e7eb" strokeWidth="0.5"/>
            </pattern>
          </defs>
          <rect x={margin.left} y={margin.top} width={plotWidth} height={plotHeight} fill="url(#grid)" />
          
          {/* 漏斗形状 (95% CI区域) */}
          <path
            d={`M ${xScale(pooledEffect)} ${margin.top}
                L ${funnelPoints[funnelPoints.length - 1].left.x} ${funnelPoints[funnelPoints.length - 1].left.y}
                L ${funnelPoints[funnelPoints.length - 1].right.x} ${funnelPoints[funnelPoints.length - 1].right.y}
                Z`}
            fill="rgba(59, 130, 246, 0.1)"
            stroke="rgba(59, 130, 246, 0.3)"
            strokeWidth="1"
          />
          
          {/* 合并效应量垂直线 */}
          <line
            x1={xScale(pooledEffect)}
            y1={margin.top}
            x2={xScale(pooledEffect)}
            y2={margin.top + plotHeight}
            stroke="#3b82f6"
            strokeWidth="2"
            strokeDasharray="5,5"
          />
          
          {/* 坐标轴 */}
          <line x1={margin.left} y1={margin.top + plotHeight} x2={margin.left + plotWidth} y2={margin.top + plotHeight} stroke="#64748b" strokeWidth="1" />
          <line x1={margin.left} y1={margin.top} x2={margin.left} y2={margin.top + plotHeight} stroke="#64748b" strokeWidth="1" />
          
          {/* X轴刻度和标签 */}
          {[minEffect, (minEffect + maxEffect) / 2, maxEffect].map((val, i) => (
            <g key={i}>
              <line x1={xScale(val)} y1={margin.top + plotHeight} x2={xScale(val)} y2={margin.top + plotHeight + 5} stroke="#64748b" strokeWidth="1" />
              <text x={xScale(val)} y={margin.top + plotHeight + 20} textAnchor="middle" className="text-xs fill-slate-500">
                {val.toFixed(2)}
              </text>
            </g>
          ))}
          <text x={margin.left + plotWidth / 2} y={height - 10} textAnchor="middle" className="text-sm fill-slate-600 font-medium">
            效应量
          </text>
          
          {/* Y轴刻度和标签 */}
          {[0, maxSe / 2, maxSe].map((val, i) => (
            <g key={i}>
              <line x1={margin.left - 5} y1={yScale(val)} x2={margin.left} y2={yScale(val)} stroke="#64748b" strokeWidth="1" />
              <text x={margin.left - 10} y={yScale(val) + 4} textAnchor="end" className="text-xs fill-slate-500">
                {val.toFixed(2)}
              </text>
            </g>
          ))}
          <text x={15} y={margin.top + plotHeight / 2} textAnchor="middle" transform={`rotate(-90, 15, ${margin.top + plotHeight / 2})`} className="text-sm fill-slate-600 font-medium">
            标准误 (SE)
          </text>
          
          {/* 研究点 */}
          {studies.map((study, i) => (
            <g key={study.studyId}>
              <circle
                cx={xScale(study.effectSize)}
                cy={yScale(study.se)}
                r={Math.max(4, Math.min(8, study.weight / 10))}
                fill="#3b82f6"
                stroke="white"
                strokeWidth="1.5"
                opacity={0.8}
                className="hover:opacity-100 cursor-pointer"
              >
                <title>{`${study.studyName}\n效应量: ${study.effectSize.toFixed(3)}\nSE: ${study.se.toFixed(3)}`}</title>
              </circle>
            </g>
          ))}
        </svg>
      </div>
      
      {/* 统计检验结果 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
          <p className="text-sm text-slate-500 mb-1">Egger回归检验</p>
          <p className="font-semibold">截距: {asymmetryTest.egger.intercept.toFixed(3)} (SE: {asymmetryTest.egger.se.toFixed(3)})</p>
          <p className={`text-sm ${asymmetryTest.egger.pValue < 0.1 ? 'text-red-500' : 'text-green-500'}`}>
            P = {asymmetryTest.egger.pValue.toFixed(3)} {asymmetryTest.egger.pValue < 0.1 ? '(可能存在偏倚)' : '(无显著偏倚)'}
          </p>
        </div>
        <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
          <p className="text-sm text-slate-500 mb-1">Begg秩相关检验</p>
          <p className="font-semibold">Tau: {asymmetryTest.begg.tau.toFixed(3)}</p>
          <p className={`text-sm ${asymmetryTest.begg.pValue < 0.1 ? 'text-red-500' : 'text-green-500'}`}>
            P = {asymmetryTest.begg.pValue.toFixed(3)} {asymmetryTest.begg.pValue < 0.1 ? '(可能存在偏倚)' : '(无显著偏倚)'}
          </p>
        </div>
        <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
          <p className="text-sm text-slate-500 mb-1">异质性</p>
          <p className="font-semibold">Q = {heterogeneity.q.toFixed(2)}, I² = {(heterogeneity.i2 * 100).toFixed(1)}%</p>
          <p className="text-sm text-slate-500">τ² = {heterogeneity.tau2.toFixed(4)}</p>
        </div>
      </div>
      
      {/* 发表偏倚警告 */}
      {hasBias && (
        <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
          <div className="flex items-start gap-2">
            <TriangleAlert className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-yellow-800 dark:text-yellow-200">可能存在发表偏倚</p>
              <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                统计检验提示漏斗图可能存在不对称，建议进一步调查潜在的发表偏倚。
                可考虑使用Trim and Fill方法进行校正，或进行敏感性分析。
              </p>
            </div>
          </div>
        </div>
      )}
      
      {/* Trim and Fill结果 */}
      {data.trimFill && data.trimFill.missingStudies > 0 && (
        <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
          <p className="font-semibold mb-2">Trim and Fill 校正</p>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            估计缺失研究数: {data.trimFill.missingStudies} 篇<br/>
            调整后效应量: {data.trimFill.adjustedEffect.toFixed(3)} [{data.trimFill.adjustedCI[0].toFixed(3)}, {data.trimFill.adjustedCI[1].toFixed(3)}]
          </p>
        </div>
      )}
    </div>
  );
}
