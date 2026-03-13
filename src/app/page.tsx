'use client';

import { useState, useEffect, useCallback, useId } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { FileText, Upload, Database, BarChart3, Settings, Loader2, Trash2, Eye, CheckCircle, XCircle, Clock, AlertCircle, Brain, FileUp, Download, FileSpreadsheet, Code2, TriangleAlert, TrendingUp, Search, GitCompare, Info, RefreshCw, ClipboardCheck, Star, AlertTriangle, CheckCircle2, Layers, FolderTree, Plus, X, Lightbulb, Sparkles, Clipboard, FileDigit, ChevronDown, Play, Network } from 'lucide-react';
import QualityAssessmentTable from '@/components/QualityAssessmentTable';
import NetworkAnalysisTab from '@/components/NetworkAnalysisTab';
import DimensionDataFilter from '@/components/DimensionDataFilter';
import { LLMConfigManager } from '@/components/LLMConfigManager';

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

// 质量评分相关类型
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
  literature?: Literature;
}

interface ExtractedStudy {
  id: string;
  literature_id: string;
  study_name: string | null;
  sample_size_treatment: number | null;
  sample_size_treatment_name: string | null;
  sample_size_control: number | null;
  sample_size_control_name: string | null;
  mean_treatment: number | null;
  mean_control: number | null;
  sd_treatment: number | null;
  sd_control: number | null;
  effect_size: number | null;
  standard_error: number | null;
  ci_lower: number | null;
  ci_upper: number | null;
  events_treatment: number | null;
  events_treatment_name: string | null;
  events_control: number | null;
  events_control_name: string | null;
  outcome_type: string | null;
  outcome_type_raw: string | null;
  outcome_type_standardized: string | null;
  subgroup: string | null;
  subgroup_detail: string | null;
  confidence: number | null;
  notes: string | null;
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
  pdfSearchLinks?: Array<{ name: string; url: string }>;
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
  const [batchUploadProgress, setBatchUploadProgress] = useState<{
    total: number;
    completed: number;
    current: string;
  } | null>(null);
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
  const [selectedLiteratureIds, setSelectedLiteratureIds] = useState<string[]>([]);
  const [funnelPlotData, setFunnelPlotData] = useState<Record<string, FunnelPlotResult>>({});
  const [showRCode, setShowRCode] = useState(false);
  const [rCodeData, setRCodeData] = useState<RCodeResult | null>(null);
  const [loadingFunnelPlot, setLoadingFunnelPlot] = useState<string | null>(null);
  const [exportingExcel, setExportingExcel] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [processingCount, setProcessingCount] = useState(0);
  
  // 数据搜索和对比相关状态
  const [searchKeyword, setSearchKeyword] = useState('');
  const [searchOutcomeType, setSearchOutcomeType] = useState('');
  const [searchSubgroup, setSearchSubgroup] = useState('');
  const [compareStudies, setCompareStudies] = useState<string[]>([]);
  const [compareResult, setCompareResult] = useState<{
    outcomeType: string;
    studies: ExtractedStudy[];
    stats: {
      totalSample: number;
      totalEvents: number;
      pooledRate: number;
      heterogeneityI2: number;
    } | null;
  } | null>(null);
  const [showCompare, setShowCompare] = useState(false);
  
  // 文献分类相关状态
  const [classificationDimensions, setClassificationDimensions] = useState<Array<{
    id: string;
    name: string;
    description?: string;
    categories: string[];
    totalClassified?: number;
    categoryCounts?: Record<string, number>;
    dataAvailability?: string;
    contrastValue?: string;
  }>>([]);
  const [selectedDimension, setSelectedDimension] = useState<string | null>(null);
  const [classificationResults, setClassificationResults] = useState<Array<{
    id: string;
    literature_id: string;
    dimension_id: string;
    category: string;
    confidence: number;
    evidence?: string;
    literature?: { id: string; title: string; authors?: string; year?: number };
  }>>([]);
  const [classifying, setClassifying] = useState(false);
  const [selectedDimensionsForBatch, setSelectedDimensionsForBatch] = useState<string[]>([]);
  const [batchClassifying, setBatchClassifying] = useState(false);
  const [batchClassifyProgress, setBatchClassifyProgress] = useState<{current: number; total: number; currentName: string} | null>(null);
  const [showNewDimensionDialog, setShowNewDimensionDialog] = useState(false);
  const [newDimension, setNewDimension] = useState({ name: '', description: '', categories: '' });
  
  // 粘贴导入相关状态
  const [showPasteDialog, setShowPasteDialog] = useState(false);
  const [pasteContent, setPasteContent] = useState('');
  const [pasteType, setPasteType] = useState<'auto' | 'pdf' | 'ris' | 'xml'>('auto');
  const [pasting, setPasting] = useState(false);
  const [pasteResult, setPasteResult] = useState<{ total: number; imported: number; message: string } | null>(null);
  
  // 质量评分相关状态
  const [qualityAssessments, setQualityAssessments] = useState<QualityAssessment[]>([]);
  const [selectedAssessment, setSelectedAssessment] = useState<QualityAssessment | null>(null);
  const [showQualityDialog, setShowQualityDialog] = useState(false);
  const [assessingLiterature, setAssessingLiterature] = useState<string | null>(null);
  const [selectedScaleType, setSelectedScaleType] = useState<'rob2' | 'nos'>('rob2');
  // 批量质量评分状态
  const [batchAssessing, setBatchAssessing] = useState(false);
  const [batchAssessProgress, setBatchAssessProgress] = useState<{
    total: number;
    completed: number;
    current: string;
  } | null>(null);
  // 批量关联PDF状态
  const [attachingPdf, setAttachingPdf] = useState(false);
  const [attachResult, setAttachResult] = useState<{
    total: number;
    attached: number;
    notFound: number;
    failed: number;
  } | null>(null);
  // 待选择的关联结果（多候选匹配）
  const [pendingSelections, setPendingSelections] = useState<Array<{
    fileName: string;
    fileData: string;
    candidates: Array<{
      id: string;
      title: string;
      authors?: string;
      year?: number;
      doi?: string;
    }>;
  }>>([]);
  const [currentSelectionIndex, setCurrentSelectionIndex] = useState(0);

  useEffect(() => {
    setMounted(true);
    const savedKey = localStorage.getItem('deepseek_api_key');
    if (savedKey) setApiKey(savedKey);
    // 加载分类维度
    fetch('/api/literature/classify?action=dimensions')
      .then(res => res.json())
      .then(data => {
        if (data.success) setClassificationDimensions(data.data);
      })
      .catch(err => console.error('Load dimensions error:', err));
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

  // 轮询检查处理中的文献
  useEffect(() => {
    if (!mounted) return;
    
    // 检查是否有处理中的文献
    const hasProcessing = literature.some(
      lit => lit.status === 'parsing' || lit.status === 'extracting'
    );
    
    if (hasProcessing) {
      setProcessingCount(prev => prev + 1);
      const timer = setTimeout(() => {
        loadLiterature();
        loadExtractedData();
      }, 3000); // 每3秒刷新一次
      
      return () => clearTimeout(timer);
    } else {
      setProcessingCount(0);
    }
  }, [mounted, literature, loadLiterature, loadExtractedData]);

  const loadAnalyses = useCallback(async () => {
    try {
      const res = await fetch('/api/analysis');
      const data = await res.json();
      if (data.success) setAnalyses(data.data);
    } catch (error) {
      console.error('Load analyses error:', error);
    }
  }, []);

  // 加载质量评分数据
  // 加载分类维度（带统计数据）
  const loadClassificationDimensions = useCallback(async () => {
    try {
      // 使用 stats API 获取带统计的分类维度
      const res = await fetch('/api/literature/classify?action=stats');
      const data = await res.json();
      if (data.success) {
        // 解析 description 中的额外字段
        const parsedDimensions = (data.data || []).map((dim: any) => {
          let dataAvailability = '';
          let contrastValue = '';
          let cleanDescription = dim.description || '';
          
          // 解析格式: 【dataAvailability】contrastValue \n 原描述
          if (dim.description) {
            const match = dim.description.match(/【(.+?)】(.+?)(?:\n|$)/);
            if (match) {
              dataAvailability = match[1];
              contrastValue = match[2];
              cleanDescription = dim.description.replace(/【.+?】.+\n?/, '').trim();
            } else if (dim.description.startsWith('【')) {
              // 只有 dataAvailability
              const simpleMatch = dim.description.match(/【(.+?)】/);
              if (simpleMatch) {
                dataAvailability = simpleMatch[1];
                cleanDescription = dim.description.replace(/【.+?】\s*/, '').trim();
              }
            }
          }
          
          return {
            ...dim,
            description: cleanDescription,
            dataAvailability,
            contrastValue,
          };
        });
        setClassificationDimensions(parsedDimensions);
      }
    } catch (error) {
      console.error('Load dimensions error:', error);
    }
  }, []);

  // 加载分类结果
  const loadClassificationResults = useCallback(async (dimensionId: string) => {
    try {
      const res = await fetch(`/api/literature/classify?action=results&dimensionId=${dimensionId}`);
      const data = await res.json();
      if (data.success) setClassificationResults(data.data);
    } catch (error) {
      console.error('Load classification results error:', error);
    }
  }, []);

  // 创建分类维度
  const createDimension = async () => {
    if (!newDimension.name || !newDimension.categories) {
      alert('请填写维度名称和分类选项');
      return;
    }
    
    const categories = newDimension.categories.split('\n').map(c => c.trim()).filter(c => c);
    if (categories.length < 2) {
      alert('请至少输入两个分类选项');
      return;
    }

    try {
      const res = await fetch('/api/literature/classify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_dimension',
          name: newDimension.name,
          description: newDimension.description,
          categories,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setShowNewDimensionDialog(false);
        setNewDimension({ name: '', description: '', categories: '' });
        loadClassificationDimensions();
      } else {
        alert('创建失败: ' + data.error);
      }
    } catch (error) {
      console.error('Create dimension error:', error);
      alert('创建失败');
    }
  };

  // 删除分类维度
  const deleteDimension = async (dimensionId: string) => {
    if (!confirm('确定要删除此分类维度吗？相关的分类结果也会被删除。')) return;
    
    try {
      const res = await fetch('/api/literature/classify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete_dimension', dimensionId }),
      });
      const data = await res.json();
      if (data.success) {
        loadClassificationDimensions();
        if (selectedDimension === dimensionId) {
          setSelectedDimension(null);
          setClassificationResults([]);
        }
      }
    } catch (error) {
      console.error('Delete dimension error:', error);
    }
  };

  // 执行AI分类（单个维度）
  const classifyLiterature = async () => {
    if (!selectedDimension || !apiKey) {
      alert('请选择分类维度并配置API Key');
      return;
    }

    setClassifying(true);
    try {
      const res = await fetch('/api/literature/classify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'classify',
          dimensionId: selectedDimension,
          apiKey,
        }),
      });
      const data = await res.json();
      if (data.success) {
        alert(`分类完成！共分类 ${data.data.classified} 篇文献`);
        loadClassificationResults(selectedDimension);
        loadClassificationDimensions(); // 刷新统计
      } else {
        alert('分类失败: ' + data.error);
      }
    } catch (error) {
      console.error('Classify error:', error);
      alert('分类失败');
    } finally {
      setClassifying(false);
    }
  };

  // 批量执行多个维度的AI分类
  const batchClassifyDimensions = async () => {
    if (selectedDimensionsForBatch.length === 0) {
      alert('请至少选择一个分类维度');
      return;
    }
    if (!apiKey) {
      alert('请先配置 DeepSeek API Key');
      return;
    }

    const total = selectedDimensionsForBatch.length;
    const results: {dimensionName: string; classified: number; error?: string}[] = [];
    
    setBatchClassifying(true);
    
    for (let i = 0; i < selectedDimensionsForBatch.length; i++) {
      const dimensionId = selectedDimensionsForBatch[i];
      const dim = classificationDimensions.find(d => d.id === dimensionId);
      
      setBatchClassifyProgress({
        current: i + 1,
        total,
        currentName: dim?.name || '未知维度',
      });

      try {
        const res = await fetch('/api/literature/classify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'classify',
            dimensionId,
          }),
        });
        const data = await res.json();
        
        if (data.success) {
          results.push({
            dimensionName: dim?.name || '未知维度',
            classified: data.data.classified,
          });
        } else {
          results.push({
            dimensionName: dim?.name || '未知维度',
            classified: 0,
            error: data.error,
          });
        }
      } catch (error) {
        results.push({
          dimensionName: dim?.name || '未知维度',
          classified: 0,
          error: '请求失败',
        });
      }
    }

    setBatchClassifying(false);
    setBatchClassifyProgress(null);
    
    // 显示结果汇总
    const successCount = results.filter(r => !r.error).length;
    const totalCount = results.reduce((sum, r) => sum + r.classified, 0);
    
    const detailText = results.map(r => 
      `${r.dimensionName}: ${r.error ? `❌ ${r.error}` : `✓ ${r.classified}篇`}`
    ).join('\n');
    
    alert(`批量分类完成！\n\n成功: ${successCount}/${total} 个维度\n总共分类: ${totalCount} 篇文献\n\n${detailText}`);
    
    // 刷新数据
    loadClassificationDimensions();
    if (selectedDimension) {
      loadClassificationResults(selectedDimension);
    }
  };

  // 按分类导出
  const exportByCategory = async () => {
    if (!selectedDimension) return;

    const dimension = classificationDimensions.find(d => d.id === selectedDimension);
    if (!dimension) return;

    // 统计每个分类的文献数量
    const categoryStats = (dimension.categories as string[]).map(cat => ({
      name: cat,
      count: dimension.categoryCounts?.[cat] || 0
    })).filter(s => s.count > 0);

    if (categoryStats.length === 0) {
      alert('没有可导出的分类结果，请先执行AI分类');
      return;
    }

    // 显示确认对话框
    const statsText = categoryStats.map(s => `• ${s.name}: ${s.count} 篇`).join('\n');
    if (!confirm(`将导出以下分类的文献：\n\n${statsText}\n\n共 ${dimension.totalClassified || 0} 篇文献，是否继续？`)) {
      return;
    }

    // 按每个分类导出
    for (const { name: category, count } of categoryStats) {
      const res = await fetch(`/api/literature/export?format=ris&dimensionId=${selectedDimension}&category=${encodeURIComponent(category)}`);
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${dimension.name}_${category}(${count}篇).ris`;
        a.click();
        window.URL.revokeObjectURL(url);
      }
    }
  };

  // 导出单篇文献
  const exportSingleLiterature = async (literatureId: string) => {
    const res = await fetch(`/api/literature/export?format=ris&ids=${literatureId}`);
    if (res.ok) {
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'literature.ris';
      a.click();
      window.URL.revokeObjectURL(url);
    }
  };

  // AI推荐分类维度
  const [researchQuestion, setResearchQuestion] = useState('');
  const [recommendingDimensions, setRecommendingDimensions] = useState(false);
  const [recommendedDimensions, setRecommendedDimensions] = useState<Array<{
    name: string;
    description: string;
    categories: string[];
    rationale: string;
    literatureCount: number;
    dataAvailability?: string;
    contrastValue?: string;
  }>>([]);
  const [showRecommendDialog, setShowRecommendDialog] = useState(false);
  const [selectedRecommendIndices, setSelectedRecommendIndices] = useState<number[]>([]);

  const recommendDimensions = async () => {
    if (!researchQuestion.trim()) {
      alert('请输入研究问题');
      return;
    }

    setRecommendingDimensions(true);
    try {
      const res = await fetch('/api/literature/classify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'recommend_dimensions',
          researchQuestion,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setRecommendedDimensions(data.data);
        setShowRecommendDialog(true);
      } else {
        alert('推荐失败: ' + data.error);
      }
    } catch (error) {
      console.error('Recommend dimensions error:', error);
      alert('推荐失败');
    } finally {
      setRecommendingDimensions(false);
    }
  };

  // 采纳推荐的维度
  const adoptRecommendedDimensions = async (selectedIndices: number[]) => {
    const selectedDims = selectedIndices.map(i => recommendedDimensions[i]);
    
    try {
      const res = await fetch('/api/literature/classify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'adopt_recommendations',
          dimensions: selectedDims,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setShowRecommendDialog(false);
        setRecommendedDimensions([]);
        setSelectedRecommendIndices([]);
        setResearchQuestion('');
        // 重新加载维度列表
        fetch('/api/literature/classify?action=dimensions')
          .then(res => res.json())
          .then(d => {
            if (d.success) setClassificationDimensions(d.data);
          });
        alert(`成功创建 ${data.data.length} 个分类维度`);
      }
    } catch (error) {
      console.error('Adopt recommendations error:', error);
      alert('采纳失败');
    }
  };

  // 粘贴导入文献
  const handlePasteImport = async () => {
    if (!pasteContent.trim()) {
      alert('请粘贴内容');
      return;
    }

    setPasting(true);
    setPasteResult(null);

    try {
      const res = await fetch('/api/literature/paste', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contentType: pasteType,
          content: pasteContent,
          apiKey,
          autoProcess: true,
        }),
      });
      const data = await res.json();

      if (data.success) {
        const importedCount = data.data.imported || 1;
        setPasteResult({
          total: data.data.total || 1,
          imported: importedCount,
          message: `成功导入 ${importedCount} 篇文献`,
        });
        // 刷新文献列表
        loadLiterature();
        // 刷新分类维度列表
        loadClassificationDimensions();
      } else {
        alert('导入失败: ' + data.error);
      }
    } catch (error) {
      console.error('Paste import error:', error);
      alert('导入失败');
    } finally {
      setPasting(false);
    }
  };

  // 处理文件拖拽/粘贴
  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      if (file.type === 'application/pdf') {
        // 读取PDF文件
        const reader = new FileReader();
        reader.onload = async () => {
          const base64 = (reader.result as string).split(',')[1];
          setPasteContent(base64);
          setPasteType('pdf');
          setShowPasteDialog(true);
        };
        reader.readAsDataURL(file);
      } else {
        // 读取文本文件
        const text = await file.text();
        setPasteContent(text);
        setPasteType('auto');
        setShowPasteDialog(true);
      }
    }
  };

  // 处理剪贴板粘贴
  const handleClipboardPaste = async () => {
    try {
      // 尝试读取剪贴板中的文件
      const clipboardItems = await navigator.clipboard.read();
      
      for (const item of clipboardItems) {
        // 检查是否有PDF文件
        if (item.types.includes('application/pdf')) {
          const blob = await item.getType('application/pdf');
          const reader = new FileReader();
          reader.onload = async () => {
            const base64 = (reader.result as string).split(',')[1];
            setPasteContent(base64);
            setPasteType('pdf');
          };
          reader.readAsDataURL(blob);
          setShowPasteDialog(true);
          return;
        }
        
        // 检查是否有文本
        if (item.types.includes('text/plain')) {
          const blob = await item.getType('text/plain');
          const text = await blob.text();
          setPasteContent(text);
          setPasteType('auto');
          setShowPasteDialog(true);
          return;
        }
      }
    } catch (error) {
      // 如果剪贴板API失败，打开对话框让用户手动粘贴
      setShowPasteDialog(true);
    }
  };
  const loadQualityAssessments = useCallback(async () => {
    try {
      const res = await fetch('/api/quality-assessment');
      const data = await res.json();
      if (data.success) setQualityAssessments(data.data);
    } catch (error) {
      console.error('Load quality assessments error:', error);
    }
  }, []);

  useEffect(() => {
    loadLiterature();
    loadExtractedData();
    loadAnalyses();
    loadQualityAssessments();
  }, [loadLiterature, loadExtractedData, loadAnalyses, loadQualityAssessments]);

  const saveApiKey = () => {
    if (apiKey.trim()) {
      localStorage.setItem('deepseek_api_key', apiKey);
      setShowSettings(false);
    }
  };

  // 批量上传PDF文献（异步处理）
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !apiKey) return;

    const fileList = Array.from(files);
    const total = fileList.length;
    
    setUploading(true);
    setBatchUploadProgress({ total, completed: 0, current: '' });

    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      setBatchUploadProgress({ total, completed: i, current: file.name });
      
      try {
        // 1. 上传文件到对象存储
        const formData = new FormData();
        formData.append('file', file);
        const uploadRes = await fetch('/api/literature/upload', { method: 'POST', body: formData });
        const uploadData = await uploadRes.json();
        if (!uploadData.success) throw new Error(uploadData.error);

        // 2. 创建文献记录（状态为 pending）
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

        // 3. 异步处理（不等待完成）
        fetch('/api/literature/process', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            literatureId: createData.data.id,
            fileUrl: uploadData.data.fileUrl,
            apiKey: apiKey,
          }),
        }).then(async (res) => {
          await loadLiterature();
          await loadExtractedData();
        }).catch((error) => {
          console.error('Process error:', error);
        });

        successCount++;
      } catch (error) {
        console.error(`Upload error for ${file.name}:`, error);
        failCount++;
      }
    }

    // 刷新文献列表
    await loadLiterature();
    
    setBatchUploadProgress({ total, completed: total, current: '' });
    setUploading(false);
    
    // 显示结果
    if (failCount === 0) {
      alert(`成功上传 ${successCount} 个文件，正在后台处理中...`);
    } else {
      alert(`上传完成：成功 ${successCount} 个，失败 ${failCount} 个`);
    }
    
    // 重置文件输入
    e.target.value = '';
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
      
      // 刷新分类维度列表
      loadClassificationDimensions();
    } catch (error) {
      console.error('Import error:', error);
      alert(error instanceof Error ? error.message : '导入失败');
    } finally {
      setImporting(false);
      // 重置文件输入
      e.target.value = '';
    }
  };

  // 为单个文献上传PDF
  const handleUploadPdfForLiterature = async (e: React.ChangeEvent<HTMLInputElement>, literatureId: string) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      // 上传PDF到对象存储
      const formData = new FormData();
      formData.append('file', file);
      
      const uploadRes = await fetch('/api/literature/upload', { 
        method: 'POST', 
        body: formData 
      });
      const uploadData = await uploadRes.json();
      
      if (!uploadData.success) {
        throw new Error(uploadData.error);
      }

      // 更新文献记录
      const updateRes = await fetch('/api/literature', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: literatureId,
          fileKey: uploadData.data.fileKey,
          fileName: file.name,
        }),
      });
      const updateResult = await updateRes.json();
      
      if (!updateResult.success) {
        throw new Error(updateResult.error);
      }

      // 刷新文献列表
      await loadLiterature();
      alert('PDF上传成功');

      // 如果有API Key，自动处理文献
      if (apiKey) {
        fetch('/api/literature/process', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            literatureId: literatureId,
            fileUrl: uploadData.data.fileUrl,
            apiKey: apiKey,
          }),
        }).then(async () => {
          await loadLiterature();
          await loadExtractedData();
        }).catch((error) => {
          console.error('Process error:', error);
        });
      }
    } catch (error) {
      console.error('Upload PDF error:', error);
      alert(error instanceof Error ? error.message : '上传失败');
    } finally {
      e.target.value = '';
    }
  };

  // 批量关联PDF到已有文献
  const handleAttachPdf = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setAttachingPdf(true);
    try {
      const formData = new FormData();
      for (let i = 0; i < files.length; i++) {
        formData.append('files', files[i]);
      }

      const res = await fetch('/api/literature/attach-pdf', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();

      if (data.success) {
        setAttachResult(data.data);
        await loadLiterature();
        
        // 处理待选择的关联结果（多候选匹配）
        if (data.data.pendingSelections && data.data.pendingSelections.length > 0) {
          setPendingSelections(data.data.pendingSelections);
          setCurrentSelectionIndex(0);
        } else {
          if (data.data.attached > 0) {
            alert(`成功关联 ${data.data.attached} 个 PDF 文件`);
          }
          if (data.data.notFound > 0) {
            alert(`${data.data.notFound} 个文件无法匹配到已有文献，已创建新文献记录`);
          }
        }
      } else {
        alert('关联失败: ' + data.error);
      }
    } catch (error) {
      console.error('Attach PDF error:', error);
      alert('关联失败');
    } finally {
      setAttachingPdf(false);
      e.target.value = '';
    }
  };

  // 确认关联选择
  const handleConfirmSelection = async (literatureId: string | null, createNew: boolean) => {
    if (pendingSelections.length === 0) return;
    
    const current = pendingSelections[currentSelectionIndex];
    
    try {
      const res = await fetch('/api/literature/attach-pdf', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          literatureId,
          fileName: current.fileName,
          fileData: current.fileData,
          createNew,
        }),
      });
      const data = await res.json();
      
      if (data.success) {
        // 处理下一个待选择的文件
        if (currentSelectionIndex < pendingSelections.length - 1) {
          setCurrentSelectionIndex(currentSelectionIndex + 1);
        } else {
          // 所有选择完成
          setPendingSelections([]);
          setCurrentSelectionIndex(0);
          await loadLiterature();
        }
      } else {
        alert('关联失败: ' + data.error);
      }
    } catch (error) {
      console.error('Confirm selection error:', error);
      alert('关联失败');
    }
  };

  // 跳过当前选择
  const handleSkipSelection = () => {
    if (currentSelectionIndex < pendingSelections.length - 1) {
      setCurrentSelectionIndex(currentSelectionIndex + 1);
    } else {
      setPendingSelections([]);
      setCurrentSelectionIndex(0);
    }
  };

  const deleteLiterature = async (id: string) => {
    if (!confirm('确定要删除这篇文献吗？')) return;
    try {
      await fetch(`/api/literature?id=${id}`, { method: 'DELETE' });
      await loadLiterature();
      await loadExtractedData();
      await loadQualityAssessments();
    } catch (error) {
      console.error('Delete error:', error);
    }
  };

  // 进行质量评分
  const assessQuality = async (literatureId: string, scaleType: 'rob2' | 'nos') => {
    if (!apiKey) {
      alert('请先设置 DeepSeek API Key');
      return;
    }
    
    setAssessingLiterature(literatureId);
    try {
      const res = await fetch('/api/quality-assessment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ literatureId, scaleType, apiKey }),
      });
      const data = await res.json();
      if (data.success) {
        await loadQualityAssessments();
        // 显示评估结果
        const assessment = data.data.assessment;
        if (assessment) {
          setSelectedAssessment(assessment);
          setShowQualityDialog(true);
        }
      } else {
        alert('质量评分失败: ' + data.error);
      }
    } catch (error) {
      console.error('Assess quality error:', error);
      alert('质量评分失败');
    } finally {
      setAssessingLiterature(null);
    }
  };

  // 批量质量评分
  const batchAssessQuality = async (scaleType: 'rob2' | 'nos') => {
    if (!apiKey) {
      alert('请先设置 DeepSeek API Key');
      return;
    }
    
    // 筛选出已完成但未评分的文献
    const completedLiterature = literature.filter(
      lit => lit.status === 'completed' && selectedLiteratureIds.includes(lit.id)
    );
    
    if (completedLiterature.length === 0) {
      alert('请选择已处理完成的文献进行评分');
      return;
    }
    
    setBatchAssessing(true);
    setBatchAssessProgress({ total: completedLiterature.length, completed: 0, current: '' });
    
    let successCount = 0;
    let failCount = 0;
    
    for (let i = 0; i < completedLiterature.length; i++) {
      const lit = completedLiterature[i];
      setBatchAssessProgress({ 
        total: completedLiterature.length, 
        completed: i, 
        current: lit.title || lit.id.slice(0, 8) 
      });
      
      try {
        const res = await fetch('/api/quality-assessment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ literatureId: lit.id, scaleType, apiKey }),
        });
        const data = await res.json();
        if (data.success) {
          successCount++;
        } else {
          console.error(`Assess ${lit.title} failed:`, data.error);
          failCount++;
        }
      } catch (error) {
        console.error(`Assess ${lit.title} error:`, error);
        failCount++;
      }
    }
    
    // 刷新评分列表
    await loadQualityAssessments();
    
    setBatchAssessProgress({ 
      total: completedLiterature.length, 
      completed: completedLiterature.length, 
      current: '' 
    });
    setBatchAssessing(false);
    
    if (failCount === 0) {
      alert(`批量评分完成：成功 ${successCount} 篇`);
    } else {
      alert(`批量评分完成：成功 ${successCount} 篇，失败 ${failCount} 篇`);
    }
  };

  // 获取文献的质量评分
  const getLiteratureQuality = (literatureId: string) => {
    return qualityAssessments.find(a => a.literature_id === literatureId);
  };

  // 渲染偏倚风险颜色
  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'low': return 'bg-green-500';
      case 'some_concerns': return 'bg-yellow-500';
      case 'high': return 'bg-red-500';
      default: return 'bg-gray-300';
    }
  };

  // 渲染偏倚风险标签
  const getRiskBadge = (risk: string) => {
    switch (risk) {
      case 'low': return <Badge className="bg-green-100 text-green-800 border-green-200"><CheckCircle2 className="h-3 w-3 mr-1" />低风险</Badge>;
      case 'some_concerns': return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200"><AlertTriangle className="h-3 w-3 mr-1" />有些担忧</Badge>;
      case 'high': return <Badge className="bg-red-100 text-red-800 border-red-200"><XCircle className="h-3 w-3 mr-1" />高风险</Badge>;
      default: return <Badge variant="outline">未评估</Badge>;
    }
  };

  // 重新提取文献数据
  const reextractLiterature = async (id: string) => {
    if (!apiKey) {
      alert('请先设置 DeepSeek API Key');
      return;
    }
    if (!confirm('确定要重新提取这篇文献的数据吗？这将删除已有的提取数据。')) return;
    
    try {
      const res = await fetch('/api/literature/reextract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ literatureId: id, apiKey }),
      });
      const data = await res.json();
      if (data.success) {
        alert(`重新提取成功，共提取 ${data.data.studiesCount} 条数据`);
        await loadLiterature();
        await loadExtractedData();
      } else {
        alert('重新提取失败: ' + data.error);
      }
    } catch (error) {
      console.error('Re-extract error:', error);
      alert('重新提取失败');
    }
  };

  // 文献多选功能
  const toggleLiteratureSelection = (id: string) => {
    setSelectedLiteratureIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const toggleAllLiterature = () => {
    if (selectedLiteratureIds.length === literature.length) {
      setSelectedLiteratureIds([]);
    } else {
      setSelectedLiteratureIds(literature.map(lit => lit.id));
    }
  };

  const deleteSelectedLiterature = async () => {
    if (selectedLiteratureIds.length === 0) return;
    if (!confirm(`确定要删除选中的 ${selectedLiteratureIds.length} 篇文献吗？此操作不可恢复。`)) return;

    try {
      const res = await fetch('/api/literature/batch-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: selectedLiteratureIds }),
      });
      const data = await res.json();
      if (data.success) {
        setSelectedLiteratureIds([]);
        await loadLiterature();
        await loadExtractedData();
      } else {
        alert('删除失败: ' + data.error);
      }
    } catch (error) {
      console.error('Batch delete error:', error);
      alert('删除失败');
    }
  };

  const toggleStudySelection = (id: string) => {
    setSelectedStudies(prev => 
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    );
  };

  // 数据搜索功能
  const filteredStudies = extractedStudies.filter(study => {
    const keywordMatch = !searchKeyword || 
      study.study_name?.toLowerCase().includes(searchKeyword.toLowerCase()) ||
      study.outcome_type?.toLowerCase().includes(searchKeyword.toLowerCase()) ||
      study.outcome_type_raw?.toLowerCase().includes(searchKeyword.toLowerCase()) ||
      study.outcome_type_standardized?.toLowerCase().includes(searchKeyword.toLowerCase()) ||
      study.sample_size_treatment_name?.toLowerCase().includes(searchKeyword.toLowerCase()) ||
      study.events_treatment_name?.toLowerCase().includes(searchKeyword.toLowerCase()) ||
      study.subgroup?.toLowerCase().includes(searchKeyword.toLowerCase());
    
    const outcomeMatch = !searchOutcomeType || 
      study.outcome_type?.toLowerCase().includes(searchOutcomeType.toLowerCase()) ||
      study.outcome_type_standardized?.toLowerCase().includes(searchOutcomeType.toLowerCase());
    
    const subgroupMatch = !searchSubgroup || 
      study.subgroup?.toLowerCase().includes(searchSubgroup.toLowerCase());
    
    return keywordMatch && outcomeMatch && subgroupMatch;
  });

  // 获取所有唯一的结局指标类型
  const uniqueOutcomeTypes = Array.from(new Set(
    extractedStudies
      .map(s => s.outcome_type)
      .filter((v): v is string => !!v)
  ));

  // 获取所有唯一的亚组
  const uniqueSubgroups = Array.from(new Set(
    extractedStudies
      .map(s => s.subgroup)
      .filter((v): v is string => !!v)
  ));

  // 对比研究切换
  const toggleCompareStudy = (id: string) => {
    setCompareStudies(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  // 执行对比分析
  const runCompareAnalysis = () => {
    if (compareStudies.length < 2) {
      alert('请至少选择2项研究进行对比');
      return;
    }

    const selectedData = extractedStudies.filter(s => compareStudies.includes(s.id));
    
    // 检查结局指标一致性（改为警示而非阻止）
    const outcomeTypes = new Set(selectedData.map(s => s.outcome_type).filter(Boolean));
    const outcomeTypeList = Array.from(outcomeTypes);
    
    // 如果结局指标不一致，显示警告但允许继续
    if (outcomeTypes.size > 1) {
      const warningMessage = `⚠️ 注意：选择的研究包含 ${outcomeTypes.size} 种不同的结局指标：\n\n${outcomeTypeList.map(t => `• ${t}`).join('\n')}\n\n不同结局指标可能代表不同的临床意义，合并分析需谨慎。\n\n常见可合并的情况：\n• "Live Birth Rate (per transfer)" 和 "Live Birth Rate (per retrieval)" 可以一起分析\n• 相似但命名不同的指标（如"妊娠率"和"临床妊娠率"）\n\n是否继续进行对比分析？`;
      
      if (!confirm(warningMessage)) {
        return;
      }
    }

    // 计算汇总统计
    const totalSampleTreatment = selectedData.reduce((sum, s) => sum + (s.sample_size_treatment || 0), 0);
    const totalSampleControl = selectedData.reduce((sum, s) => sum + (s.sample_size_control || 0), 0);
    const totalEventsTreatment = selectedData.reduce((sum, s) => sum + (s.events_treatment || 0), 0);
    const totalEventsControl = selectedData.reduce((sum, s) => sum + (s.events_control || 0), 0);

    // 计算合并率
    const pooledRateTreatment = totalSampleTreatment > 0 ? totalEventsTreatment / totalSampleTreatment : 0;
    const pooledRateControl = totalSampleControl > 0 ? totalEventsControl / totalSampleControl : 0;

    // 计算异质性 I²
    let heterogeneityI2 = 0;
    if (selectedData.every(s => s.effect_size !== null && s.standard_error !== null)) {
      const effectSizes = selectedData.map(s => s.effect_size!);
      const weights = selectedData.map(s => 1 / Math.pow(s.standard_error!, 2));
      const totalWeight = weights.reduce((a, b) => a + b, 0);
      const weightedMean = effectSizes.reduce((sum, es, i) => sum + es * weights[i], 0) / totalWeight;
      
      const Q = effectSizes.reduce((sum, es, i) => sum + weights[i] * Math.pow(es - weightedMean, 2), 0);
      const df = selectedData.length - 1;
      const I2 = Math.max(0, (Q - df) / Q * 100);
      heterogeneityI2 = I2;
    }

    setCompareResult({
      outcomeType: outcomeTypes.size > 1 
        ? `${outcomeTypeList.length} 种结局指标 (混合分析)` 
        : (selectedData[0]?.outcome_type || '未知'),
      studies: selectedData,
      stats: {
        totalSample: totalSampleTreatment + totalSampleControl,
        totalEvents: totalEventsTreatment + totalEventsControl,
        pooledRate: pooledRateTreatment,
        heterogeneityI2,
      },
    });
    setShowCompare(true);
  };

  // 快速创建Meta分析
  const quickCreateAnalysis = () => {
    if (compareStudies.length < 2) {
      alert('请至少选择2项研究');
      return;
    }
    
    // 检查结局指标一致性
    const selectedData = extractedStudies.filter(s => compareStudies.includes(s.id));
    const outcomeTypes = new Set(selectedData.map(s => s.outcome_type).filter(Boolean));
    
    if (outcomeTypes.size > 1) {
      const outcomeTypeList = Array.from(outcomeTypes);
      const warningMessage = `⚠️ 注意：选择的研究包含 ${outcomeTypes.size} 种不同的结局指标：\n\n${outcomeTypeList.map(t => `• ${t}`).join('\n')}\n\n不同结局指标可能代表不同的临床意义，合并分析需谨慎。\n\n是否继续创建Meta分析？`;
      
      if (!confirm(warningMessage)) {
        return;
      }
    }
    
    // 设置选中的研究并跳转到数据提取Tab
    setSelectedStudies(compareStudies);
    setActiveTab('data');
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
      case 'parsing': return <Loader2 className="h-4 w-4 text-orange-500 animate-spin" />;
      case 'error': return <XCircle className="h-4 w-4 text-red-500" />;
      default: return <Clock className="h-4 w-4 text-slate-400" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'completed': return '已完成';
      case 'extracting': return 'AI提取中...';
      case 'parsing': return '解析文档中...';
      case 'error': return '处理失败';
      default: return '待处理';
    }
  };

  const getStatusBadge = (status: string) => {
    const baseClasses = "inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium";
    switch (status) {
      case 'completed': 
        return <span className={`${baseClasses} bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400`}>
          <CheckCircle className="h-3 w-3" /> 已完成
        </span>;
      case 'extracting': 
        return <span className={`${baseClasses} bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400`}>
          <Loader2 className="h-3 w-3 animate-spin" /> AI提取中
        </span>;
      case 'parsing': 
        return <span className={`${baseClasses} bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400`}>
          <Loader2 className="h-3 w-3 animate-spin" /> 解析中
        </span>;
      case 'error': 
        return <span className={`${baseClasses} bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400`}>
          <XCircle className="h-3 w-3" /> 失败
        </span>;
      default: 
        return <span className={`${baseClasses} bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400`}>
          <Clock className="h-3 w-3" /> 待处理
        </span>;
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
            <CardHeader>
              <CardTitle className="text-base">系统设置</CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="llm">
                <TabsList className="mb-4">
                  <TabsTrigger value="llm">模型配置</TabsTrigger>
                  <TabsTrigger value="legacy">旧版配置</TabsTrigger>
                </TabsList>
                <TabsContent value="llm">
                  <LLMConfigManager />
                </TabsContent>
                <TabsContent value="legacy">
                  <div className="space-y-2">
                    <Label>DeepSeek API Key (已废弃)</Label>
                    <p className="text-sm text-muted-foreground mb-2">
                      此配置已废弃，请使用上方的"模型配置"管理您的API密钥
                    </p>
                    <div className="flex gap-2">
                      <Input type="password" placeholder="输入你的 DeepSeek API Key" value={apiKey} onChange={(e) => setApiKey(e.target.value)} />
                      <Button onClick={saveApiKey}>保存</Button>
                    </div>
                    <p className="text-xs text-slate-500">从 <a href="https://platform.deepseek.com" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">DeepSeek 平台</a> 获取</p>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-7 mb-6">
            <TabsTrigger value="literature" className="gap-2"><Upload className="h-4 w-4" /> 文献管理</TabsTrigger>
            <TabsTrigger value="classify" className="gap-2"><Layers className="h-4 w-4" /> 文献分类</TabsTrigger>
            <TabsTrigger value="data" className="gap-2"><Database className="h-4 w-4" /> 数据提取</TabsTrigger>
            <TabsTrigger value="compare" className="gap-2"><Search className="h-4 w-4" /> 数据对比</TabsTrigger>
            <TabsTrigger value="quality" className="gap-2"><ClipboardCheck className="h-4 w-4" /> 质量评分</TabsTrigger>
            <TabsTrigger value="analysis" className="gap-2"><BarChart3 className="h-4 w-4" /> Meta分析</TabsTrigger>
            <TabsTrigger value="network" className="gap-2"><Network className="h-4 w-4" /> 网状分析</TabsTrigger>
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
                    <Button 
                      variant="outline"
                      onClick={() => document.getElementById('import-file')?.click()}
                      disabled={importing}
                    >
                      {importing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileSpreadsheet className="mr-2 h-4 w-4" />}
                      {importing ? '导入中...' : '导入EndNote'}
                    </Button>
                    {/* 粘贴导入按钮 */}
                    <Button 
                      variant="outline"
                      onClick={() => setShowPasteDialog(true)}
                    >
                      <Clipboard className="mr-2 h-4 w-4" />
                      粘贴导入
                    </Button>
                    {/* 关联PDF到已有文献 - 支持多选，自动匹配 */}
                    <input type="file" id="attach-pdf" className="hidden" accept=".pdf" onChange={handleAttachPdf} disabled={attachingPdf} multiple />
                    <Button 
                      variant="outline"
                      onClick={() => document.getElementById('attach-pdf')?.click()}
                      disabled={attachingPdf || literature.length === 0}
                      title="选择本地PDF文件，自动匹配到已导入的文献"
                    >
                      {attachingPdf ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileUp className="mr-2 h-4 w-4" />}
                      {attachingPdf ? '关联中...' : '批量关联PDF'}
                    </Button>
                    {/* 上传PDF按钮 */}
                    <input type="file" id="file-upload" className="hidden" accept=".pdf,.doc,.docx" onChange={handleUpload} disabled={uploading} multiple />
                    <Button 
                      onClick={() => {
                        if (!apiKey) {
                          alert('请先在设置中配置 DeepSeek API Key');
                          setShowSettings(true);
                          return;
                        }
                        document.getElementById('file-upload')?.click();
                      }}
                      disabled={uploading}
                    >
                      {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileUp className="mr-2 h-4 w-4" />}
                      {uploading && batchUploadProgress 
                        ? `上传中 (${batchUploadProgress.completed}/${batchUploadProgress.total})...` 
                        : '批量上传PDF'}
                    </Button>
                    {/* 批量上传进度提示 */}
                    {uploading && batchUploadProgress && (
                      <div className="flex items-center gap-2 text-sm text-slate-600">
                        <span>正在上传: {batchUploadProgress.current}</span>
                      </div>
                    )}
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
                  <>
                    {/* 处理进度提示 */}
                    {literature.some(lit => lit.status === 'parsing' || lit.status === 'extracting') && (
                      <div className="flex items-center gap-2 mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                        <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                        <span className="text-sm text-blue-700 dark:text-blue-300">
                          有 {literature.filter(lit => lit.status === 'parsing' || lit.status === 'extracting').length} 篇文献正在后台处理中，页面将自动刷新...
                        </span>
                      </div>
                    )}
                    {/* 批量操作栏 */}
                    {selectedLiteratureIds.length > 0 && (
                      <div className="flex items-center justify-between mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                        <span className="text-sm text-blue-700 dark:text-blue-300">
                          已选择 {selectedLiteratureIds.length} 篇文献
                          {batchAssessing && batchAssessProgress && (
                            <span className="ml-2">
                              (评分中 {batchAssessProgress.completed}/{batchAssessProgress.total})
                            </span>
                          )}
                        </span>
                        <div className="flex gap-2 items-center">
                          {/* 批量质量评分 */}
                          <div className="flex items-center gap-2 mr-2">
                            <Select 
                              value={selectedScaleType} 
                              onValueChange={(v) => setSelectedScaleType(v as 'rob2' | 'nos')}
                              disabled={batchAssessing}
                            >
                              <SelectTrigger className="w-32 h-8">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="rob2">RoB 2.0</SelectItem>
                                <SelectItem value="nos">NOS量表</SelectItem>
                              </SelectContent>
                            </Select>
                            <Button 
                              size="sm" 
                              onClick={() => batchAssessQuality(selectedScaleType)}
                              disabled={batchAssessing}
                            >
                              {batchAssessing ? (
                                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                              ) : (
                                <ClipboardCheck className="h-4 w-4 mr-1" />
                              )}
                              批量评分
                            </Button>
                          </div>
                          <Button variant="outline" size="sm" onClick={() => setSelectedLiteratureIds([])} disabled={batchAssessing}>
                            取消选择
                          </Button>
                          <Button variant="destructive" size="sm" onClick={deleteSelectedLiterature} disabled={batchAssessing}>
                            <Trash2 className="h-4 w-4 mr-1" />
                            删除选中
                          </Button>
                        </div>
                      </div>
                    )}
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-12">
                            <Checkbox
                              checked={literature.length > 0 && selectedLiteratureIds.length === literature.length}
                              onCheckedChange={toggleAllLiterature}
                              aria-label="全选"
                            />
                          </TableHead>
                          <TableHead>状态</TableHead>
                          <TableHead>文献名称</TableHead>
                          <TableHead>作者</TableHead>
                          <TableHead>年份</TableHead>
                          <TableHead>期刊</TableHead>
                          <TableHead>质量评分</TableHead>
                          <TableHead>PDF</TableHead>
                          <TableHead>操作</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {literature.map((lit) => {
                          const quality = getLiteratureQuality(lit.id);
                          return (
                          <TableRow key={lit.id} className={selectedLiteratureIds.includes(lit.id) ? 'bg-blue-50 dark:bg-blue-900/10' : ''}>
                            <TableCell>
                              <Checkbox
                                checked={selectedLiteratureIds.includes(lit.id)}
                                onCheckedChange={() => toggleLiteratureSelection(lit.id)}
                                aria-label="选择此文献"
                              />
                            </TableCell>
                            <TableCell>
                              {getStatusBadge(lit.status)}
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
                            {quality ? (
                              <div className="flex flex-col gap-1">
                                {getRiskBadge(quality.overall_risk)}
                                {quality.total_score !== null && (
                                  <div className="text-xs text-slate-500">
                                    {quality.total_score}/{quality.max_score} ★
                                  </div>
                                )}
                              </div>
                            ) : (
                              <Badge variant="outline" className="text-slate-400">未评估</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            {lit.file_name ? (
                              <Badge variant="secondary" className="gap-1">
                                <FileText className="h-3 w-3" /> 已上传
                              </Badge>
                            ) : (
                              <div className="flex items-center gap-1">
                                <Badge variant="outline" className="text-slate-400">无PDF</Badge>
                                <input 
                                  type="file" 
                                  id={`upload-pdf-${lit.id}`} 
                                  className="hidden" 
                                  accept=".pdf" 
                                  onChange={(e) => handleUploadPdfForLiterature(e, lit.id)}
                                />
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  onClick={() => document.getElementById(`upload-pdf-${lit.id}`)?.click()}
                                  title="上传PDF"
                                  className="h-6 px-2"
                                >
                                  <FileUp className="h-3 w-3" />
                                </Button>
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button variant="ghost" size="sm" onClick={() => setSelectedLiterature(lit)} title="查看详情">
                                <Eye className="h-4 w-4" />
                              </Button>
                              {lit.status === 'completed' && (
                                <>
                                  <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    onClick={() => {
                                      const scale = quality?.scale_type || selectedScaleType;
                                      assessQuality(lit.id, scale as 'rob2' | 'nos');
                                    }} 
                                    title="质量评分"
                                    disabled={assessingLiterature === lit.id}
                                  >
                                    {assessingLiterature === lit.id ? (
                                      <Loader2 className="h-4 w-4 animate-spin text-purple-500" />
                                    ) : (
                                      <ClipboardCheck className={`h-4 w-4 ${quality ? 'text-green-500' : 'text-purple-500'}`} />
                                    )}
                                  </Button>
                                  <Button variant="ghost" size="sm" onClick={() => reextractLiterature(lit.id)} title="重新提取数据">
                                    <RefreshCw className="h-4 w-4 text-blue-500" />
                                  </Button>
                                </>
                              )}
                              {quality && (
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  onClick={() => {
                                    setSelectedAssessment(quality);
                                    setShowQualityDialog(true);
                                  }} 
                                  title="查看评分详情"
                                >
                                  <Info className="h-4 w-4 text-slate-400" />
                                </Button>
                              )}
                              <Button variant="ghost" size="sm" onClick={() => deleteLiterature(lit.id)} title="删除">
                                <Trash2 className="h-4 w-4 text-red-500" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                      })}
                    </TableBody>
                  </Table>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* 文献分类 Tab */}
          <TabsContent value="classify">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>文献智能分类</CardTitle>
                    <CardDescription>根据研究特征对文献进行分组，支持亚组分析和敏感性分析</CardDescription>
                  </div>
                  <Button onClick={() => setShowNewDimensionDialog(true)}>
                    <Plus className="mr-2 h-4 w-4" /> 新建分类维度
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {/* AI推荐分类维度 */}
                  <div className="border rounded-lg p-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20">
                    <div className="flex items-start gap-4">
                      <div className="flex-1">
                        <h3 className="font-medium mb-2 flex items-center gap-2">
                          <Brain className="h-5 w-5 text-blue-500" />
                          AI智能推荐分类维度
                        </h3>
                        <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
                          输入您的研究问题，AI将分析文献内容并推荐适合的亚组分析维度
                        </p>
                        <div className="flex gap-2">
                          <Input
                            placeholder="如：PGT技术对活产率的影响"
                            value={researchQuestion}
                            onChange={(e) => setResearchQuestion(e.target.value)}
                            className="flex-1"
                          />
                          <Button 
                            onClick={recommendDimensions}
                            disabled={recommendingDimensions || !apiKey}
                          >
                            {recommendingDimensions ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                分析中...
                              </>
                            ) : (
                              <>
                                <Lightbulb className="mr-2 h-4 w-4" />
                                AI推荐
                              </>
                            )}
                          </Button>
                        </div>
                        {!apiKey && (
                          <p className="text-xs text-amber-600 mt-2">请先在设置中配置 DeepSeek API Key</p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* 分类维度选择 */}
                  <div className="space-y-3">
                    {/* 批量操作栏 */}
                    {classificationDimensions.length > 0 && (
                      <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                        <Checkbox
                          checked={selectedDimensionsForBatch.length === classificationDimensions.length}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedDimensionsForBatch(classificationDimensions.map(d => d.id));
                            } else {
                              setSelectedDimensionsForBatch([]);
                            }
                          }}
                        />
                        <span className="text-sm text-slate-600">
                          全选 ({selectedDimensionsForBatch.length}/{classificationDimensions.length})
                        </span>
                        {selectedDimensionsForBatch.length > 0 && (
                          <>
                            <Button
                              size="sm"
                              onClick={batchClassifyDimensions}
                              disabled={batchClassifying || !apiKey}
                              className="ml-auto"
                            >
                              {batchClassifying ? (
                                <>
                                  {batchClassifyProgress && (
                                    <span className="mr-2">
                                      {batchClassifyProgress.current}/{batchClassifyProgress.total}
                                    </span>
                                  )}
                                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                                  批量分类中...
                                </>
                              ) : (
                                <>
                                  <Play className="h-4 w-4 mr-1" />
                                  批量分类 ({selectedDimensionsForBatch.length} 个维度)
                                </>
                              )}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setSelectedDimensionsForBatch([])}
                            >
                              取消选择
                            </Button>
                          </>
                        )}
                      </div>
                    )}
                    
                    {/* 维度卡片网格 */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {classificationDimensions.map((dim) => {
                        const hasEnoughData = (dim.totalClassified || 0) >= 2;
                        const validCategories = (dim.categories as string[]).filter(
                          cat => (dim.categoryCounts?.[cat] || 0) >= 2
                        );
                        const isValidForMeta = validCategories.length >= 2;
                        const isSelectedForBatch = selectedDimensionsForBatch.includes(dim.id);
                        
                        return (
                        <Card 
                          key={dim.id} 
                          className={`cursor-pointer transition-all ${
                            selectedDimension === dim.id ? 'ring-2 ring-blue-500' : ''
                          } ${isSelectedForBatch ? 'ring-2 ring-green-500 bg-green-50/50' : ''} ${isValidForMeta ? 'border-green-200' : ''}`}
                        >
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <Checkbox
                                  checked={isSelectedForBatch}
                                  onCheckedChange={(checked) => {
                                    if (checked) {
                                      setSelectedDimensionsForBatch(prev => [...prev, dim.id]);
                                    } else {
                                      setSelectedDimensionsForBatch(prev => prev.filter(id => id !== dim.id));
                                    }
                                  }}
                                  onClick={(e) => e.stopPropagation()}
                                />
                                <h3 
                                  className="font-medium hover:text-blue-600 cursor-pointer"
                                  onClick={() => {
                                    setSelectedDimension(dim.id);
                                    loadClassificationResults(dim.id);
                                  }}
                                >
                                  {dim.name}
                                </h3>
                                {isValidForMeta && (
                                  <Badge variant="default" className="bg-green-500 text-xs">
                                    可用于Meta
                                  </Badge>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                {dim.totalClassified && dim.totalClassified > 0 && (
                                  <Badge variant="outline" className="text-xs">
                                    {dim.totalClassified} 篇
                                  </Badge>
                                )}
                                <Button 
                                  variant="ghost" 
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    deleteDimension(dim.id);
                                  }}
                                >
                                  <Trash2 className="h-4 w-4 text-slate-400 hover:text-red-500" />
                                </Button>
                              </div>
                            </div>
                          
                          {/* 数据可获得性标识 */}
                          {dim.dataAvailability && (
                            <div className={`text-xs mb-2 px-2 py-1 rounded ${
                              dim.dataAvailability === '有明确数据' 
                                ? 'bg-green-100 text-green-700' 
                                : dim.dataAvailability === '可能有数据'
                                ? 'bg-amber-100 text-amber-700'
                                : 'bg-slate-100 text-slate-600'
                            }`}>
                              📊 {dim.dataAvailability}
                            </div>
                          )}
                          
                          {dim.description && (
                            <p className="text-sm text-slate-500 mb-2">{dim.description}</p>
                          )}
                          
                          {/* 对照价值说明 */}
                          {dim.contrastValue && (
                            <p className="text-xs text-blue-600 mb-2 italic">
                              💡 {dim.contrastValue}
                            </p>
                          )}
                          
                          {/* 分类标签 */}
                          <div className="flex flex-wrap gap-1">
                            {(dim.categories as string[]).map((cat, idx) => {
                              const count = dim.categoryCounts?.[cat] || 0;
                              const hasEnough = count >= 2;
                              return (
                                <Badge 
                                  key={idx} 
                                  variant={hasEnough ? "default" : count > 0 ? "secondary" : "outline"} 
                                  className={`text-xs ${hasEnough ? 'bg-green-500' : ''}`}
                                >
                                  {cat} {count > 0 && `(${count})`}
                                </Badge>
                              );
                            })}
                          </div>
                        </CardContent>
                      </Card>
                      );
                    })}
                  </div>
                  </div>

                  {/* 分类操作区 */}
                  {selectedDimension && (() => {
                    const dimension = classificationDimensions.find(d => d.id === selectedDimension);
                    const totalCount = dimension?.totalClassified || 0;
                    return (
                    <div className="border rounded-lg p-4 space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="font-medium">
                          执行AI分类
                          {totalCount > 0 && (
                            <span className="ml-2 text-sm font-normal text-slate-500">
                              (已分类 {totalCount} 篇)
                            </span>
                          )}
                        </h3>
                        <div className="flex gap-2">
                          <Button 
                            onClick={classifyLiterature} 
                            disabled={classifying || !apiKey}
                          >
                            {classifying ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                分类中...
                              </>
                            ) : (
                              <>
                                <Brain className="mr-2 h-4 w-4" />
                                开始分类
                              </>
                            )}
                          </Button>
                          <Button 
                            variant="outline" 
                            onClick={exportByCategory}
                            disabled={totalCount === 0}
                          >
                            <Download className="mr-2 h-4 w-4" />
                            按分类导出 {totalCount > 0 && `(${totalCount}篇)`}
                          </Button>
                        </div>
                      </div>
                      {!apiKey && (
                        <p className="text-sm text-amber-600">请先在设置中配置 DeepSeek API Key</p>
                      )}
                    </div>
                    );
                  })()}

                  {/* 分类结果 - 按分类分组展示 */}
                  {classificationResults.length > 0 && (() => {
                    const dimension = classificationDimensions.find(d => d.id === selectedDimension);
                    // 按分类分组
                    const groupedResults = classificationResults.reduce((acc, result) => {
                      const cat = result.category || '未分类';
                      if (!acc[cat]) acc[cat] = [];
                      acc[cat].push(result);
                      return acc;
                    }, {} as Record<string, typeof classificationResults>);
                    
                    const categories = Object.keys(groupedResults);
                    const validCategories = categories.filter(cat => groupedResults[cat].length >= 2);
                    const invalidCategories = categories.filter(cat => groupedResults[cat].length < 2);
                    
                    return (
                    <div className="space-y-4">
                      {/* 统计概览 */}
                      <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="font-medium">分类统计</h4>
                            <p className="text-sm text-slate-600 mt-1">
                              共 <strong>{classificationResults.length}</strong> 篇文献，分为 <strong>{categories.length}</strong> 个类别
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={exportByCategory}
                            >
                              <Download className="h-4 w-4 mr-1" />
                              批量导出
                            </Button>
                            <Button 
                              variant="default" 
                              size="sm"
                              onClick={async () => {
                                const count = classificationResults.length;
                                if (!confirm(`确定导出全部 ${count} 篇已分类文献？`)) return;
                                const ids = classificationResults.map(r => r.literature_id).join(',');
                                const res = await fetch(`/api/literature/export?format=ris&ids=${ids}`);
                                if (res.ok) {
                                  const blob = await res.blob();
                                  const url = window.URL.createObjectURL(blob);
                                  const a = document.createElement('a');
                                  a.href = url;
                                  a.download = `${dimension?.name || 'classification'}_全部(${count}篇).ris`;
                                  a.click();
                                  window.URL.revokeObjectURL(url);
                                }
                              }}
                            >
                              <FileText className="h-4 w-4 mr-1" />
                              导出全部 ({classificationResults.length} 篇)
                            </Button>
                          </div>
                        </div>
                        
                        {/* 可用于Meta分析的提示 */}
                        {validCategories.length >= 2 ? (
                          <div className="mt-3 p-2 bg-green-100 dark:bg-green-900/30 rounded text-sm text-green-700 dark:text-green-300">
                            ✓ 有 {validCategories.length} 个类别可用于 Meta 分析（每类≥2篇）
                          </div>
                        ) : (
                          <div className="mt-3 p-2 bg-amber-100 dark:bg-amber-900/30 rounded text-sm text-amber-700 dark:text-amber-300">
                            ⚠ 仅有 {validCategories.length} 个类别可用于 Meta 分析。建议每个类别至少有 2 篇文献才能进行比较分析。
                          </div>
                        )}
                      </div>
                      
                      {/* 有效分类（≥2篇） */}
                      {validCategories.length > 0 && (
                        <div>
                          <h4 className="text-sm font-medium text-green-700 dark:text-green-300 mb-2">
                            ✓ 可用于 Meta 分析的类别 ({validCategories.length}个)
                          </h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                            {validCategories.map(cat => (
                              <Card key={cat} className="border-green-200 dark:border-green-800">
                                <CardHeader className="p-3 pb-2">
                                  <div className="flex items-center justify-between">
                                    <CardTitle className="text-sm">{cat}</CardTitle>
                                    <Badge variant="default" className="bg-green-500">
                                      {groupedResults[cat].length} 篇
                                    </Badge>
                                  </div>
                                </CardHeader>
                                <CardContent className="p-3 pt-0">
                                  <ScrollArea className="h-32 mb-2">
                                    <div className="space-y-1">
                                      {groupedResults[cat].slice(0, 5).map(r => (
                                        <div key={r.id} className="text-xs text-slate-600 truncate" title={r.literature?.title}>
                                          • {r.literature?.title}
                                        </div>
                                      ))}
                                      {groupedResults[cat].length > 5 && (
                                        <div className="text-xs text-slate-400">
                                          ...还有 {groupedResults[cat].length - 5} 篇
                                        </div>
                                      )}
                                    </div>
                                  </ScrollArea>
                                  <Button 
                                    size="sm" 
                                    className="w-full"
                                    onClick={async () => {
                                      const ids = groupedResults[cat].map(r => r.literature_id).join(',');
                                      const res = await fetch(`/api/literature/export?format=ris&ids=${ids}`);
                                      if (res.ok) {
                                        const blob = await res.blob();
                                        const url = window.URL.createObjectURL(blob);
                                        const a = document.createElement('a');
                                        a.href = url;
                                        a.download = `${dimension?.name || 'classification'}_${cat}(${groupedResults[cat].length}篇).ris`;
                                        a.click();
                                        window.URL.revokeObjectURL(url);
                                      }
                                    }}
                                  >
                                    <Download className="h-3 w-3 mr-1" />
                                    下载此类 ({groupedResults[cat].length}篇)
                                  </Button>
                                </CardContent>
                              </Card>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {/* 无效分类（<2篇） */}
                      {invalidCategories.length > 0 && (
                        <div>
                          <h4 className="text-sm font-medium text-amber-700 dark:text-amber-300 mb-2">
                            ⚠ 文献不足的类别 ({invalidCategories.length}个，需≥2篇才能用于Meta分析)
                          </h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2">
                            {invalidCategories.map(cat => (
                              <Card key={cat} className="border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-900/10">
                                <CardContent className="p-3">
                                  <div className="flex items-center justify-between">
                                    <span className="text-sm">{cat}</span>
                                    <Badge variant="outline" className="text-amber-600 border-amber-300">
                                      {groupedResults[cat].length} 篇
                                    </Badge>
                                  </div>
                                  <div className="text-xs text-slate-500 mt-1 truncate">
                                    {groupedResults[cat][0]?.literature?.title}
                                  </div>
                                </CardContent>
                              </Card>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {/* 详细列表（可折叠） */}
                      <Collapsible>
                        <CollapsibleTrigger className="w-full">
                          <div className="flex items-center justify-center gap-2 p-2 text-sm text-slate-500 hover:text-slate-700 border rounded-lg">
                            <ChevronDown className="h-4 w-4" />
                            查看详细分类列表
                          </div>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <div className="border rounded-lg mt-2">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>文献</TableHead>
                                  <TableHead>分类</TableHead>
                                  <TableHead>置信度</TableHead>
                                  <TableHead>证据</TableHead>
                                  <TableHead>操作</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {classificationResults.map((result) => (
                                  <TableRow key={result.id}>
                                    <TableCell>
                                      <div>
                                        <div className="font-medium text-sm">{result.literature?.title}</div>
                                        {result.literature?.authors && (
                                          <div className="text-xs text-slate-500">
                                            {result.literature.authors} ({result.literature.year || '未知年份'})
                                          </div>
                                        )}
                                      </div>
                                    </TableCell>
                                    <TableCell>
                                      <Badge variant={groupedResults[result.category]?.length >= 2 ? "default" : "secondary"}>
                                        {result.category}
                                      </Badge>
                                    </TableCell>
                                    <TableCell>
                                      <div className="flex items-center gap-2">
                                        <div className="w-16 h-2 bg-slate-200 rounded-full overflow-hidden">
                                          <div 
                                            className={`h-full ${result.confidence >= 0.8 ? 'bg-green-500' : result.confidence >= 0.5 ? 'bg-yellow-500' : 'bg-red-500'}`}
                                            style={{ width: `${result.confidence * 100}%` }}
                                          />
                                        </div>
                                        <span className="text-xs">{(result.confidence * 100).toFixed(0)}%</span>
                                      </div>
                                    </TableCell>
                                    <TableCell>
                                      <p className="text-xs text-slate-600 max-w-xs truncate" title={result.evidence}>
                                        {result.evidence || '-'}
                                      </p>
                                    </TableCell>
                                    <TableCell>
                                      <Button 
                                        variant="ghost" 
                                        size="sm"
                                        onClick={() => exportSingleLiterature(result.literature_id)}
                                      >
                                        <Download className="h-4 w-4" />
                                      </Button>
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    </div>
                    );
                  })()}

                  {/* 空状态 - 无分类维度 */}
                  {classificationDimensions.length === 0 && (
                    <div className="text-center py-12">
                      <Layers className="mx-auto h-12 w-12 text-slate-300 mb-4" />
                      <p className="text-slate-500 mb-2">暂无分类维度</p>
                      <p className="text-sm text-slate-400 mb-4">
                        创建分类维度后，可对文献进行智能分组
                      </p>
                      
                      {/* 引导流程 */}
                      <div className="max-w-md mx-auto text-left bg-slate-50 dark:bg-slate-800 p-4 rounded-lg mb-4">
                        <h4 className="font-medium mb-3 text-center">📚 使用流程</h4>
                        <div className="space-y-3">
                          <div className="flex items-start gap-3">
                            <div className="w-6 h-6 rounded-full bg-blue-500 text-white text-xs flex items-center justify-center flex-shrink-0">1</div>
                            <div>
                              <p className="text-sm font-medium">导入文献</p>
                              <p className="text-xs text-slate-500">在"文献管理"中上传PDF或导入EndNote文件</p>
                            </div>
                          </div>
                          <div className="flex items-start gap-3">
                            <div className="w-6 h-6 rounded-full bg-blue-500 text-white text-xs flex items-center justify-center flex-shrink-0">2</div>
                            <div>
                              <p className="text-sm font-medium">创建分类维度</p>
                              <p className="text-xs text-slate-500">定义分组标准，如研究类型、样本特征等</p>
                            </div>
                          </div>
                          <div className="flex items-start gap-3">
                            <div className="w-6 h-6 rounded-full bg-blue-500 text-white text-xs flex items-center justify-center flex-shrink-0">3</div>
                            <div>
                              <p className="text-sm font-medium">执行AI分类</p>
                              <p className="text-xs text-slate-500">AI自动分析文献内容并归类</p>
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex gap-2 justify-center">
                        {literature.length === 0 && (
                          <Button variant="outline" onClick={() => setActiveTab('literature')}>
                            <Upload className="mr-2 h-4 w-4" /> 先去导入文献
                          </Button>
                        )}
                        <Button onClick={() => setShowNewDimensionDialog(true)}>
                          <Plus className="mr-2 h-4 w-4" /> 新建分类维度
                        </Button>
                      </div>
                    </div>
                  )}
                  
                  {/* 有维度但无文献的提示 */}
                  {classificationDimensions.length > 0 && literature.length === 0 && (
                    <div className="text-center py-8 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
                      <AlertCircle className="mx-auto h-8 w-8 text-amber-500 mb-2" />
                      <p className="text-amber-700 dark:text-amber-300 font-medium mb-1">暂无可分类的文献</p>
                      <p className="text-sm text-amber-600 dark:text-amber-400 mb-3">
                        请先导入文献后再执行分类
                      </p>
                      <Button onClick={() => setActiveTab('literature')}>
                        <Upload className="mr-2 h-4 w-4" /> 前往导入文献
                      </Button>
                    </div>
                  )}
                </div>
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
                          <TableHead>样本量 (治疗组/对照组)</TableHead>
                          <TableHead>事件数 (治疗组/对照组)</TableHead>
                          <TableHead>效应量</TableHead>
                          <TableHead>95% CI</TableHead>
                          <TableHead>结局指标</TableHead>
                          <TableHead>亚组</TableHead>
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
                            <TableCell>
                              {study.sample_size_treatment && study.sample_size_control ? (
                                <div className="text-sm">
                                  <span className="font-medium">{study.sample_size_treatment}/{study.sample_size_control}</span>
                                  {study.sample_size_treatment_name && (
                                    <div className="text-xs text-slate-500">{study.sample_size_treatment_name}</div>
                                  )}
                                </div>
                              ) : '-'}
                            </TableCell>
                            <TableCell>
                              {study.events_treatment !== null && study.events_control !== null ? (
                                <div className="text-sm">
                                  <span className="font-medium">{study.events_treatment}/{study.events_control}</span>
                                  {study.events_treatment_name && (
                                    <div className="text-xs text-slate-500">{study.events_treatment_name}</div>
                                  )}
                                </div>
                              ) : '-'}
                            </TableCell>
                            <TableCell>{study.effect_size !== null ? study.effect_size.toFixed(3) : '-'}</TableCell>
                            <TableCell>{study.ci_lower !== null && study.ci_upper !== null ? `[${study.ci_lower.toFixed(3)}, ${study.ci_upper.toFixed(3)}]` : '-'}</TableCell>
                            <TableCell>
                              <div className="max-w-[150px]">
                                <div className="truncate font-medium" title={study.outcome_type || ''}>{study.outcome_type || '-'}</div>
                                {study.outcome_type_raw && study.outcome_type_standardized && 
                                 study.outcome_type_raw !== study.outcome_type_standardized && (
                                  <div className="text-xs text-slate-400 truncate" title={`原始名称: ${study.outcome_type_raw}`}>
                                    原始: {study.outcome_type_raw}
                                  </div>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              {study.subgroup ? (
                                <div className="max-w-[120px]">
                                  <div className="truncate text-sm font-medium" title={study.subgroup}>{study.subgroup}</div>
                                  {study.subgroup_detail && (
                                    <div className="text-xs text-slate-400 truncate" title={study.subgroup_detail}>{study.subgroup_detail}</div>
                                  )}
                                </div>
                              ) : '-'}
                            </TableCell>
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

          <TabsContent value="compare">
            <div className="space-y-6">
              {/* 分类维度筛选器 */}
              <DimensionDataFilter
                dimensions={classificationDimensions}
                extractedStudies={extractedStudies}
                onFilterChange={(filtered, dimensionId, category) => {
                  if (dimensionId && category) {
                    // 当使用分类维度筛选时，更新显示的数据
                    console.log(`筛选维度: ${dimensionId}, 分类: ${category}, 数据: ${filtered.length}条`);
                  }
                }}
                onCreateNetworkAnalysis={(analysisId, category, studies) => {
                  // 创建网状分析后跳转到网状分析页面
                  setActiveTab('network');
                }}
              />
              
              {/* 搜索和筛选区域 */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Search className="h-5 w-5" />
                    数据搜索与对比
                  </CardTitle>
                  <CardDescription>
                    搜索文献数据，对比不同研究的同一指标，快速发现差异
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-4">
                    <div className="flex-1 min-w-[200px]">
                      <Label className="text-sm text-slate-500 mb-1 block">关键词搜索</Label>
                      <Input
                        placeholder="搜索研究名称、结局指标、亚组..."
                        value={searchKeyword}
                        onChange={(e) => setSearchKeyword(e.target.value)}
                        className="w-full"
                      />
                    </div>
                    <div className="w-[200px]">
                      <Label className="text-sm text-slate-500 mb-1 block">结局指标类型</Label>
                      <Select 
                        value={searchOutcomeType || "all"} 
                        onValueChange={(v) => setSearchOutcomeType(v === "all" ? "" : v)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="全部类型" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">全部类型</SelectItem>
                          {uniqueOutcomeTypes.map(type => (
                            <SelectItem key={type} value={type}>{type}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="w-[200px]">
                      <Label className="text-sm text-slate-500 mb-1 block">亚组</Label>
                      <Select 
                        value={searchSubgroup || "all"} 
                        onValueChange={(v) => setSearchSubgroup(v === "all" ? "" : v)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="全部亚组" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">全部亚组</SelectItem>
                          {uniqueSubgroups.map(group => (
                            <SelectItem key={group} value={group}>{group}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  
                  {/* 搜索结果统计 */}
                  <div className="mt-4 flex items-center justify-between">
                    <div className="text-sm text-slate-500">
                      找到 <span className="font-medium text-slate-700">{filteredStudies.length}</span> 条数据记录
                      {compareStudies.length > 0 && (
                        <span className="ml-4">
                          已选择 <span className="font-medium text-blue-600">{compareStudies.length}</span> 项进行对比
                        </span>
                      )}
                    </div>
                    {compareStudies.length >= 2 && (
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => setCompareStudies([])}>
                          清除选择
                        </Button>
                        <Button variant="outline" size="sm" onClick={quickCreateAnalysis}>
                          <BarChart3 className="h-4 w-4 mr-1" />
                          快速Meta分析
                        </Button>
                        <Button size="sm" onClick={runCompareAnalysis}>
                          <GitCompare className="h-4 w-4 mr-1" />
                          对比分析
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* 数据表格 */}
              <Card>
                <CardContent className="pt-6">
                  {filteredStudies.length === 0 ? (
                    <div className="text-center py-12">
                      <Search className="mx-auto h-12 w-12 text-slate-300 mb-4" />
                      <p className="text-slate-500">未找到匹配的数据</p>
                      <p className="text-sm text-slate-400 mt-1">尝试调整搜索条件</p>
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-12">对比</TableHead>
                          <TableHead>研究名称</TableHead>
                          <TableHead>结局指标</TableHead>
                          <TableHead>亚组</TableHead>
                          <TableHead>样本量 (治疗/对照)</TableHead>
                          <TableHead>事件数 (治疗/对照)</TableHead>
                          <TableHead>效应量</TableHead>
                          <TableHead>95% CI</TableHead>
                          <TableHead>置信度</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredStudies.map((study) => (
                          <TableRow 
                            key={study.id}
                            className={compareStudies.includes(study.id) ? 'bg-blue-50 dark:bg-blue-900/10' : ''}
                          >
                            <TableCell>
                              <Checkbox
                                checked={compareStudies.includes(study.id)}
                                onCheckedChange={() => toggleCompareStudy(study.id)}
                              />
                            </TableCell>
                            <TableCell className="font-medium">{study.study_name || '未命名'}</TableCell>
                            <TableCell>
                              <div className="max-w-[150px]">
                                <div className="truncate font-medium" title={study.outcome_type || ''}>
                                  <Badge variant="secondary" className="text-xs">
                                    {study.outcome_type || '未分类'}
                                  </Badge>
                                </div>
                                {study.outcome_type_raw && study.outcome_type_standardized && 
                                 study.outcome_type_raw !== study.outcome_type_standardized && (
                                  <div className="text-xs text-slate-400 mt-1 truncate" title={`原始名称: ${study.outcome_type_raw}`}>
                                    原始: {study.outcome_type_raw}
                                  </div>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              {study.subgroup ? (
                                <div className="max-w-[120px]">
                                  <Badge variant="outline" className="text-xs truncate max-w-full" title={study.subgroup}>
                                    {study.subgroup}
                                  </Badge>
                                  {study.subgroup_detail && (
                                    <div className="text-xs text-slate-400 mt-1 truncate" title={study.subgroup_detail}>
                                      {study.subgroup_detail}
                                    </div>
                                  )}
                                </div>
                              ) : '-'}
                            </TableCell>
                            <TableCell>
                              {study.sample_size_treatment && study.sample_size_control ? (
                                <div className="text-sm">
                                  <span className="font-medium">{study.sample_size_treatment}/{study.sample_size_control}</span>
                                  {study.sample_size_treatment_name && (
                                    <div className="text-xs text-slate-500">{study.sample_size_treatment_name}</div>
                                  )}
                                </div>
                              ) : '-'}
                            </TableCell>
                            <TableCell>
                              {study.events_treatment !== null && study.events_control !== null ? (
                                <div className="text-sm">
                                  <span className="font-medium">{study.events_treatment}/{study.events_control}</span>
                                  {study.events_treatment_name && (
                                    <div className="text-xs text-slate-500">{study.events_treatment_name}</div>
                                  )}
                                </div>
                              ) : '-'}
                            </TableCell>
                            <TableCell>
                              {study.effect_size !== null ? (
                                <span className="font-mono">{study.effect_size.toFixed(3)}</span>
                              ) : '-'}
                            </TableCell>
                            <TableCell>
                              {study.ci_lower !== null && study.ci_upper !== null ? (
                                <span className="font-mono text-xs">
                                  [{study.ci_lower.toFixed(3)}, {study.ci_upper.toFixed(3)}]
                                </span>
                              ) : '-'}
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
                  )}
              </CardContent>
            </Card>
            </div>

            {/* 对比结果对话框 */}
              <Dialog open={showCompare} onOpenChange={setShowCompare}>
                <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <GitCompare className="h-5 w-5" />
                      数据对比分析结果
                    </DialogTitle>
                    <DialogDescription>
                      结局指标: {compareResult?.outcomeType}
                      {compareResult?.outcomeType?.includes('混合分析') && (
                        <span className="ml-2 text-amber-500">⚠️ 请谨慎解读结果</span>
                      )}
                    </DialogDescription>
                  </DialogHeader>
                  
                  {compareResult && (
                    <div className="space-y-6">
                      {/* 混合分析警告 */}
                      {compareResult.outcomeType.includes('混合分析') && (
                        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
                          <div className="flex items-start gap-3">
                            <TriangleAlert className="h-5 w-5 text-amber-500 mt-0.5" />
                            <div className="text-sm">
                              <div className="font-medium text-amber-800 dark:text-amber-200">混合结局指标分析</div>
                              <div className="text-amber-700 dark:text-amber-300 mt-1">
                                当前分析包含多种结局指标，合并效应量可能缺乏临床意义。建议在解释结果时考虑不同指标的差异。
                              </div>
                              <div className="text-amber-600 dark:text-amber-400 mt-2 text-xs">
                                包含的结局指标：{Array.from(new Set(compareResult.studies.map(s => s.outcome_type).filter(Boolean))).join('、')}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                      
                      {/* 汇总统计 */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <Card className="p-4">
                          <div className="text-sm text-slate-500">总样本量</div>
                          <div className="text-2xl font-bold">{compareResult.stats?.totalSample.toLocaleString()}</div>
                        </Card>
                        <Card className="p-4">
                          <div className="text-sm text-slate-500">总事件数</div>
                          <div className="text-2xl font-bold">{compareResult.stats?.totalEvents.toLocaleString()}</div>
                        </Card>
                        <Card className="p-4">
                          <div className="text-sm text-slate-500">合并率</div>
                          <div className="text-2xl font-bold">
                            {compareResult.stats?.pooledRate != null 
                              ? (compareResult.stats.pooledRate * 100).toFixed(1) + '%'
                              : '-'}
                          </div>
                        </Card>
                        <Card className="p-4">
                          <div className="text-sm text-slate-500">异质性 I²</div>
                          <div className={`text-2xl font-bold ${
                            ((compareResult.stats?.heterogeneityI2 ?? 0)) > 50 ? 'text-orange-500' : 'text-green-500'
                          }`}>
                            {(compareResult.stats?.heterogeneityI2 ?? 0).toFixed(1)}%
                          </div>
                          <div className="text-xs text-slate-400">
                            {((compareResult.stats?.heterogeneityI2 ?? 0)) > 50 ? '高异质性' : '低异质性'}
                          </div>
                        </Card>
                      </div>

                      {/* 研究对比详情 */}
                      <div>
                        <h4 className="font-semibold mb-3 flex items-center gap-2">
                          <Info className="h-4 w-4" />
                          各研究数据对比
                        </h4>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>研究</TableHead>
                              <TableHead>样本量 (治疗/对照)</TableHead>
                              <TableHead>事件数 (治疗/对照)</TableHead>
                              <TableHead>效应量</TableHead>
                              <TableHead>置信区间</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {compareResult.studies.map((study) => (
                              <TableRow key={study.id}>
                                <TableCell className="font-medium">{study.study_name}</TableCell>
                                <TableCell>
                                  {study.sample_size_treatment}/{study.sample_size_control}
                                </TableCell>
                                <TableCell>
                                  {study.events_treatment ?? '-'}/{study.events_control ?? '-'}
                                </TableCell>
                                <TableCell>
                                  {study.effect_size?.toFixed(3) ?? '-'}
                                </TableCell>
                                <TableCell>
                                  {study.ci_lower !== null && study.ci_upper !== null
                                    ? `[${study.ci_lower.toFixed(3)}, ${study.ci_upper.toFixed(3)}]`
                                    : '-'}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>

                      {/* 数据差异提示 */}
                      <Card className="bg-slate-50 dark:bg-slate-800">
                        <CardContent className="pt-4">
                          <h4 className="font-semibold mb-2">数据差异分析</h4>
                          <div className="text-sm text-slate-600 space-y-1">
                            {compareResult.studies.length > 1 && (
                              <>
                                <p>• 研究数量: {compareResult.studies.length} 项</p>
                                <p>• 效应量范围: {
                                  Math.min(...compareResult.studies.map(s => s.effect_size ?? 0)).toFixed(3)
                                } ~ {
                                  Math.max(...compareResult.studies.map(s => s.effect_size ?? 0)).toFixed(3)
                                }</p>
                                <p>• 异质性评价: {
                                  (compareResult.stats?.heterogeneityI2 || 0) > 75 ? '高异质性 (>75%)，建议使用随机效应模型' :
                                  (compareResult.stats?.heterogeneityI2 || 0) > 50 ? '中等异质性 (50-75%)，可考虑亚组分析' :
                                  '低异质性 (<50%)，研究间一致性较好'
                                }</p>
                              </>
                            )}
                          </div>
                        </CardContent>
                      </Card>

                      {/* 操作按钮 */}
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" onClick={() => setShowCompare(false)}>
                          关闭
                        </Button>
                        <Button onClick={() => {
                          setShowCompare(false);
                          quickCreateAnalysis();
                        }}>
                          <BarChart3 className="h-4 w-4 mr-1" />
                          创建Meta分析
                        </Button>
                      </div>
                    </div>
                  )}
                </DialogContent>
              </Dialog>
          </TabsContent>

          <TabsContent value="quality">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ClipboardCheck className="h-5 w-5" />
                  质量评分汇总表
                </CardTitle>
                <CardDescription>
                  基于国际通用量表的文献质量评估，支持导出发表级表格
                </CardDescription>
              </CardHeader>
              <CardContent>
                <QualityAssessmentTable assessments={qualityAssessments} />
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

          {/* 网状Meta分析 */}
          <TabsContent value="network">
            <NetworkAnalysisTab 
              apiKey={apiKey} 
              extractedStudies={extractedStudies}
              classificationDimensions={classificationDimensions}
            />
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
                      <TableHead>说明 / PDF获取</TableHead>
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
                        <TableCell className="text-sm">
                          <div className="text-slate-500">{record.message}</div>
                          {record.pdfSearchLinks && record.pdfSearchLinks.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {record.pdfSearchLinks.map((link, j) => (
                                <a
                                  key={j}
                                  href={link.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 hover:bg-blue-200 rounded"
                                >
                                  {link.name}
                                </a>
                              ))}
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
              
              {/* 引导用户去分类 */}
              {importResult.imported > 0 && (
                <div className="mt-4 pt-4 border-t">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">下一步：文献智能分类</p>
                      <p className="text-xs text-slate-500">创建分类维度，对文献进行亚组分析或敏感性分析</p>
                    </div>
                    <Button 
                      onClick={() => {
                        setShowImportResult(false);
                        setActiveTab('classify');
                      }}
                    >
                      <Layers className="mr-2 h-4 w-4" />
                      前往文献分类
                    </Button>
                  </div>
                </div>
              )}
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

      {/* PDF关联选择对话框 */}
      {/* 粘贴导入对话框 */}
      <Dialog open={showPasteDialog} onOpenChange={setShowPasteDialog}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Clipboard className="h-5 w-5" />
              粘贴导入文献
            </DialogTitle>
            <DialogDescription>
              粘贴PDF文件内容或EndNote格式文本，自动识别并导入
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* 内容类型选择 */}
            <div className="flex gap-2">
              <Button 
                variant={pasteType === 'auto' ? 'default' : 'outline'} 
                size="sm"
                onClick={() => setPasteType('auto')}
              >
                自动检测
              </Button>
              <Button 
                variant={pasteType === 'ris' ? 'default' : 'outline'} 
                size="sm"
                onClick={() => setPasteType('ris')}
              >
                RIS格式
              </Button>
              <Button 
                variant={pasteType === 'xml' ? 'default' : 'outline'} 
                size="sm"
                onClick={() => setPasteType('xml')}
              >
                XML格式
              </Button>
              <Button 
                variant={pasteType === 'pdf' ? 'default' : 'outline'} 
                size="sm"
                onClick={() => setPasteType('pdf')}
              >
                PDF (Base64)
              </Button>
            </div>

            {/* 粘贴区域 */}
            <div className="space-y-2">
              <Label>粘贴内容</Label>
              <Textarea
                placeholder={
                  pasteType === 'pdf' 
                    ? '粘贴PDF文件的Base64编码内容...' 
                    : pasteType === 'ris'
                    ? '粘贴RIS格式内容，例如：\nTY  - JOUR\nTI  - 文章标题\nAU  - 作者\n...'
                    : pasteType === 'xml'
                    ? '粘贴EndNote XML格式内容...'
                    : '粘贴内容，系统将自动识别格式...\n\n支持：\n• RIS格式 (TY  - JOUR...)\n• EndNote XML格式 (<xml>...)</xml>\n• PDF Base64编码'
                }
                value={pasteContent}
                onChange={(e) => setPasteContent(e.target.value)}
                rows={12}
                className="font-mono text-sm"
              />
              <p className="text-xs text-slate-500">
                {pasteType === 'pdf' 
                  ? '提示：可以打开PDF文件，全选复制内容后粘贴到这里' 
                  : '提示：可以从EndNote导出RIS或XML格式，复制内容粘贴到这里'}
              </p>
            </div>

            {/* 导入结果 */}
            {pasteResult && (
              <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
                <div className="flex items-center gap-2 text-green-700 dark:text-green-300">
                  <CheckCircle className="h-5 w-5" />
                  <span className="font-medium">{pasteResult.message}</span>
                </div>
                {pasteResult.total > 1 && (
                  <p className="text-sm text-green-600 dark:text-green-400 mt-1">
                    共处理 {pasteResult.total} 条记录，成功导入 {pasteResult.imported} 条
                  </p>
                )}
                {/* 引导用户去分类 */}
                <div className="mt-3 pt-3 border-t border-green-200 dark:border-green-800">
                  <p className="text-sm text-green-700 dark:text-green-300 mb-2">
                    下一步：创建分类维度，对文献进行智能分组
                  </p>
                  <Button 
                    size="sm"
                    onClick={() => {
                      setShowPasteDialog(false);
                      setPasteContent('');
                      setPasteResult(null);
                      setActiveTab('classify');
                    }}
                  >
                    <Layers className="mr-2 h-4 w-4" />
                    前往文献分类
                  </Button>
                </div>
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => {
              setShowPasteDialog(false);
              setPasteContent('');
              setPasteResult(null);
            }}>
              关闭
            </Button>
            <Button onClick={handlePasteImport} disabled={pasting || !pasteContent.trim()}>
              {pasting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  导入中...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  开始导入
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* AI推荐维度对话框 */}
      <Dialog open={showRecommendDialog} onOpenChange={(open) => {
        setShowRecommendDialog(open);
        if (open && recommendedDimensions.length > 0) {
          // 打开时默认全选
          setSelectedRecommendIndices(recommendedDimensions.map((_, i) => i));
        }
      }}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-yellow-500" />
              AI推荐的分类维度
            </DialogTitle>
            <DialogDescription>
              根据研究问题「{researchQuestion}」和文献内容，AI推荐以下分类维度。
              请勾选需要采纳的维度。
            </DialogDescription>
          </DialogHeader>
          
          {/* 全选/取消全选 */}
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <Checkbox
                id="select-all"
                checked={selectedRecommendIndices.length === recommendedDimensions.length}
                onCheckedChange={(checked) => {
                  if (checked) {
                    setSelectedRecommendIndices(recommendedDimensions.map((_, i) => i));
                  } else {
                    setSelectedRecommendIndices([]);
                  }
                }}
              />
              <Label htmlFor="select-all" className="text-sm cursor-pointer">
                全选 ({recommendedDimensions.length} 个维度)
              </Label>
            </div>
            <span className="text-sm text-slate-500">
              已选中 {selectedRecommendIndices.length} 个
            </span>
          </div>
          
          <div className="space-y-3 py-2">
            {recommendedDimensions.map((dim, idx) => {
              const hasEnoughCategories = dim.categories.length >= 2;
              const isSelected = selectedRecommendIndices.includes(idx);
              
              return (
              <div 
                key={idx} 
                className={`border rounded-lg p-4 transition-all cursor-pointer ${
                  isSelected 
                    ? 'border-blue-500 bg-blue-50/50 ring-1 ring-blue-500' 
                    : 'hover:border-slate-300'
                } ${
                  hasEnoughCategories && dim.dataAvailability !== '信息不足'
                    ? 'border-green-200' 
                    : ''
                }`}
                onClick={() => {
                  if (isSelected) {
                    setSelectedRecommendIndices(prev => prev.filter(i => i !== idx));
                  } else {
                    setSelectedRecommendIndices(prev => [...prev, idx]);
                  }
                }}
              >
                <div className="flex items-start gap-3">
                  {/* 复选框 */}
                  <Checkbox
                    id={`dim-${idx}`}
                    checked={isSelected}
                    onCheckedChange={() => {
                      // 点击复选框也会触发
                    }}
                    className="mt-1"
                  />
                  
                  <div className="flex-1">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium">{dim.name}</h4>
                        {hasEnoughCategories && dim.dataAvailability === '有明确数据' && (
                          <Badge variant="default" className="bg-green-500 text-xs">
                            ✓ 有数据
                          </Badge>
                        )}
                        {dim.dataAvailability === '可能有数据' && (
                          <Badge variant="secondary" className="text-xs">
                            ? 可能有数据
                          </Badge>
                        )}
                      </div>
                      <Badge variant="outline">
                        约 {dim.literatureCount} 篇可分类
                      </Badge>
                    </div>
                    
                    {/* 数据可获得性 */}
                    {dim.dataAvailability && (
                      <div className={`text-xs mb-2 px-2 py-1 rounded inline-block ${
                        dim.dataAvailability === '有明确数据' 
                          ? 'bg-green-100 text-green-700' 
                          : dim.dataAvailability === '可能有数据'
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-slate-100 text-slate-600'
                      }`}>
                        📊 数据：{dim.dataAvailability}
                      </div>
                    )}
                    
                    <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">
                      {dim.description}
                    </p>
                    
                    {/* 对照价值 */}
                    {dim.contrastValue && (
                      <p className="text-xs text-blue-600 mb-2 bg-blue-50 px-2 py-1 rounded">
                        💡 对照价值：{dim.contrastValue}
                      </p>
                    )}
                    
                    <div className="flex flex-wrap gap-1 mb-2">
                      {dim.categories.map((cat, catIdx) => (
                        <Badge key={catIdx} variant="outline" className="text-xs">
                          {cat}
                        </Badge>
                      ))}
                    </div>
                    <p className="text-xs text-slate-500">
                      <strong>推荐理由：</strong>{dim.rationale}
                    </p>
                  </div>
                </div>
              </div>
              );
            })}
          </div>
          <div className="flex justify-between items-center pt-2 border-t">
            <p className="text-sm text-slate-500">
              将采纳 {selectedRecommendIndices.length} 个分类维度
            </p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowRecommendDialog(false)}>
                取消
              </Button>
              <Button 
                onClick={() => {
                  if (selectedRecommendIndices.length === 0) {
                    alert('请至少选择一个分类维度');
                    return;
                  }
                  adoptRecommendedDimensions(selectedRecommendIndices);
                }}
                disabled={selectedRecommendIndices.length === 0}
              >
                <Plus className="mr-2 h-4 w-4" />
                采纳选中项 ({selectedRecommendIndices.length})
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 新建分类维度对话框 */}
      <Dialog open={showNewDimensionDialog} onOpenChange={setShowNewDimensionDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>新建分类维度</DialogTitle>
            <DialogDescription>
              创建一个分类维度，用于对文献进行分组（如：按年龄分组、按移植方式分组等）
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="dim-name">维度名称 *</Label>
              <Input
                id="dim-name"
                placeholder="如：年龄分组、移植方式"
                value={newDimension.name}
                onChange={(e) => setNewDimension({ ...newDimension, name: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="dim-desc">描述</Label>
              <Input
                id="dim-desc"
                placeholder="如：按患者年龄进行亚组分析"
                value={newDimension.description}
                onChange={(e) => setNewDimension({ ...newDimension, description: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="dim-categories">分类选项 *（每行一个）</Label>
              <Textarea
                id="dim-categories"
                placeholder={"< 35岁\n≥ 35岁\n未说明"}
                value={newDimension.categories}
                onChange={(e) => setNewDimension({ ...newDimension, categories: e.target.value })}
                rows={4}
              />
              <p className="text-xs text-slate-500 mt-1">
                每行输入一个分类选项，AI将根据文献内容自动判断属于哪个分类
              </p>
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setShowNewDimensionDialog(false)}>
              取消
            </Button>
            <Button onClick={createDimension}>
              创建
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* PDF关联选择对话框 */}
      <Dialog open={pendingSelections.length > 0} onOpenChange={(open) => !open && setPendingSelections([])}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileUp className="h-5 w-5" />
              选择关联文献 ({currentSelectionIndex + 1}/{pendingSelections.length})
            </DialogTitle>
            <DialogDescription>
              文件名：<span className="font-medium text-slate-700 dark:text-slate-300">{pendingSelections[currentSelectionIndex]?.fileName}</span>
              <br />
              <span className="text-sm">找到 {pendingSelections[currentSelectionIndex]?.candidates.length || 0} 个可能匹配的文献，请选择正确的关联对象</span>
            </DialogDescription>
          </DialogHeader>

          {pendingSelections.length > 0 && (
            <div className="space-y-4">
              {/* 候选文献列表 */}
              <div className="space-y-2">
                {pendingSelections[currentSelectionIndex]?.candidates.map((candidate, idx) => (
                  <div 
                    key={candidate.id}
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800"
                  >
                    <div className="flex-1">
                      <div className="font-medium text-sm">{candidate.title}</div>
                      {candidate.authors && (
                        <div className="text-xs text-slate-500 mt-1">
                          作者：{candidate.authors}
                          {candidate.year && ` (${candidate.year})`}
                        </div>
                      )}
                      {candidate.doi && (
                        <div className="text-xs text-slate-400 mt-0.5">
                          DOI: {candidate.doi}
                        </div>
                      )}
                    </div>
                    <Button
                      size="sm"
                      onClick={() => handleConfirmSelection(candidate.id, false)}
                    >
                      选择此项
                    </Button>
                  </div>
                ))}
              </div>

              {/* 操作按钮 */}
              <div className="flex justify-between pt-4 border-t">
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => handleConfirmSelection(null, true)}
                  >
                    创建为新文献
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={handleSkipSelection}
                  >
                    跳过
                  </Button>
                </div>
                <div className="text-sm text-slate-500 self-center">
                  {currentSelectionIndex + 1} / {pendingSelections.length}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* 质量评分详情对话框 */}
      <Dialog open={showQualityDialog} onOpenChange={setShowQualityDialog}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardCheck className="h-5 w-5" />
              质量评分详情
            </DialogTitle>
            <DialogDescription>
              {selectedAssessment?.scale_type === 'rob2' ? 'Cochrane RoB 2.0 偏倚风险评估' : 
               selectedAssessment?.scale_type === 'nos' ? 'Newcastle-Ottawa 量表评分' : '质量评估'}
            </DialogDescription>
          </DialogHeader>

          {selectedAssessment && (
            <div className="space-y-6">
              {/* 总体风险 */}
              <Card className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm text-slate-500">总体偏倚风险</div>
                    <div className="mt-2">
                      {getRiskBadge(selectedAssessment.overall_risk)}
                    </div>
                  </div>
                  {selectedAssessment.total_score !== null && (
                    <div className="text-right">
                      <div className="text-sm text-slate-500">总分</div>
                      <div className="text-2xl font-bold flex items-center gap-1">
                        <Star className="h-5 w-5 text-yellow-500 fill-yellow-500" />
                        {selectedAssessment.total_score}/{selectedAssessment.max_score}
                      </div>
                    </div>
                  )}
                </div>
                {selectedAssessment.reasoning && (
                  <div className="mt-4 p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                    <div className="text-sm text-slate-500 mb-1">评估理由</div>
                    <div className="text-sm">{selectedAssessment.reasoning}</div>
                  </div>
                )}
                {selectedAssessment.confidence && (
                  <div className="mt-2 text-xs text-slate-400">
                    AI评估置信度: {(selectedAssessment.confidence * 100).toFixed(0)}%
                  </div>
                )}
              </Card>

              {/* 偏倚风险可视化 (Cochrane风格) */}
              {selectedAssessment.domain_scores && (
                <Card className="p-4">
                  <CardTitle className="text-base mb-4">各域偏倚风险</CardTitle>
                  
                  {/* 偏倚风险图 */}
                  <div className="space-y-2">
                    {Object.entries(selectedAssessment.domain_scores).map(([key, domain]) => (
                      <div key={key} className="flex items-center gap-4">
                        <div className="w-24 text-sm text-slate-600">{domain.name || key}</div>
                        <div className="flex-1 flex items-center gap-1">
                          {domain.judgment && (
                            <div className={`w-8 h-8 rounded flex items-center justify-center ${
                              domain.judgment === 'low' ? 'bg-green-500' :
                              domain.judgment === 'some_concerns' ? 'bg-yellow-500' :
                              'bg-red-500'
                            }`}>
                              {domain.judgment === 'low' && <CheckCircle2 className="h-5 w-5 text-white" />}
                              {domain.judgment === 'some_concerns' && <AlertTriangle className="h-5 w-5 text-white" />}
                              {domain.judgment === 'high' && <XCircle className="h-5 w-5 text-white" />}
                            </div>
                          )}
                          {domain.earned_stars !== undefined && (
                            <div className="flex gap-1">
                              {Array.from({ length: domain.max_stars || 0 }).map((_, i) => (
                                <Star 
                                  key={i} 
                                  className={`h-5 w-5 ${i < (domain.earned_stars || 0) 
                                    ? 'text-yellow-500 fill-yellow-500' 
                                    : 'text-slate-300'}`} 
                                />
                              ))}
                            </div>
                          )}
                          <span className="text-xs text-slate-500 ml-2">
                            {domain.judgment === 'low' ? '低风险' :
                             domain.judgment === 'some_concerns' ? '有些担忧' :
                             domain.judgment === 'high' ? '高风险' : ''}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              {/* 详细条目 */}
              {selectedAssessment.domain_scores && (
                <Card className="p-4">
                  <CardTitle className="text-base mb-4">详细评估</CardTitle>
                  <div className="space-y-4">
                    {Object.entries(selectedAssessment.domain_scores).map(([key, domain]) => (
                      <div key={key} className="border-b pb-4 last:border-b-0">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="font-medium">{domain.name || key}</span>
                          {domain.judgment && (
                            <span className={`text-xs px-2 py-0.5 rounded ${
                              domain.judgment === 'low' ? 'bg-green-100 text-green-800' :
                              domain.judgment === 'some_concerns' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-red-100 text-red-800'
                            }`}>
                              {domain.judgment === 'low' ? '低风险' :
                               domain.judgment === 'some_concerns' ? '有些担忧' : '高风险'}
                            </span>
                          )}
                        </div>
                        
                        {domain.questions && (
                          <div className="space-y-2">
                            {Object.entries(domain.questions).map(([qKey, q]) => (
                              <div key={qKey} className="text-sm">
                                <div className="text-slate-500">{q.question}</div>
                                <div className="text-slate-700 dark:text-slate-300">{q.answer}</div>
                              </div>
                            ))}
                          </div>
                        )}
                        
                        {domain.reason && (
                          <div className="text-sm text-slate-500 mt-2 italic">
                            理由: {domain.reason}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              {/* 量表说明 */}
              <div className="text-xs text-slate-400 space-y-1">
                <p>量表: {selectedAssessment.scale_type === 'rob2' ? 'Cochrane RoB 2.0 - 随机对照试验偏倚风险评估工具' :
                         selectedAssessment.scale_type === 'nos' ? 'Newcastle-Ottawa量表 - 观察性研究质量评估工具' : '其他'}</p>
                <p>评估时间: {new Date(selectedAssessment.created_at).toLocaleString()}</p>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setShowQualityDialog(false)}>
              关闭
            </Button>
          </div>
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
  const gridId = useId(); // 生成唯一的 grid ID
  
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
            <pattern id={gridId} width="50" height="50" patternUnits="userSpaceOnUse">
              <path d="M 50 0 L 0 0 0 50" fill="none" stroke="#e5e7eb" strokeWidth="0.5"/>
            </pattern>
          </defs>
          <rect x={margin.left} y={margin.top} width={plotWidth} height={plotHeight} fill={`url(#${gridId})`} />
          
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
