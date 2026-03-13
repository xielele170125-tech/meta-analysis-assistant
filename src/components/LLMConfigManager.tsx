'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Settings, 
  Plus, 
  Trash2, 
  Edit, 
  Eye,
  EyeOff,
  Zap,
  AlertCircle,
  Loader2,
  Check,
  RefreshCw
} from 'lucide-react';

interface LLMConfig {
  id: string;
  name: string;
  provider: string;
  api_key: string;
  base_url: string | null;
  model: string;
  temperature: number | null;
  max_tokens: number | null;
  is_default: boolean;
  is_enabled: boolean;
  created_at: string;
  updated_at: string | null;
}

interface ProviderInfo {
  id: string;
  name: string;
  defaultConfig: {
    baseUrl?: string;
    model?: string;
  };
  availableModels: string[];
}

interface LLMConfigForm {
  id?: string;
  name: string;
  provider: string;
  apiKey: string;
  baseUrl: string;
  model: string;
  temperature: number;
  maxTokens: number;
  isDefault: boolean;
  isEnabled: boolean;
}

const defaultForm: LLMConfigForm = {
  name: '',
  provider: 'deepseek',
  apiKey: '',
  baseUrl: '',
  model: 'deepseek-chat',
  temperature: 0.7,
  maxTokens: 4096,
  isDefault: false,
  isEnabled: true,
};

export function LLMConfigManager() {
  const [configs, setConfigs] = useState<LLMConfig[]>([]);
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingConfig, setEditingConfig] = useState<LLMConfig | null>(null);
  const [form, setForm] = useState<LLMConfigForm>(defaultForm);
  const [showApiKey, setShowApiKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [stats, setStats] = useState<{
    totalRequests: number;
    totalTokens: number;
    successCount: number;
    failureCount: number;
  } | null>(null);

  // 加载配置和提供商信息
  useEffect(() => {
    loadConfigs();
    loadProviders();
    loadStats();
  }, []);

  const loadConfigs = async () => {
    try {
      const response = await fetch('/api/llm-config');
      const data = await response.json();
      setConfigs(data.configs || []);
    } catch (error) {
      console.error('Failed to load configs:', error);
      alert('无法加载LLM配置');
    } finally {
      setLoading(false);
    }
  };

  const loadProviders = async () => {
    try {
      const response = await fetch('/api/llm-config?action=providers');
      const data = await response.json();
      setProviders(data.providers || []);
    } catch (error) {
      console.error('Failed to load providers:', error);
    }
  };

  const loadStats = async () => {
    try {
      const response = await fetch('/api/llm-config?action=usage');
      const data = await response.json();
      setStats(data.stats || null);
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  };

  const handleProviderChange = (provider: string) => {
    const providerInfo = providers.find(p => p.id === provider);
    setForm({
      ...form,
      provider,
      baseUrl: providerInfo?.defaultConfig.baseUrl || '',
      model: providerInfo?.defaultConfig.model || '',
    });
  };

  const handleSubmit = async () => {
    if (!form.name || !form.provider || !form.apiKey || !form.model) {
      alert('请填写完整：名称、提供商、API密钥和模型为必填项');
      return;
    }

    try {
      const response = await fetch('/api/llm-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: form.id,
          name: form.name,
          provider: form.provider,
          apiKey: form.apiKey,
          baseUrl: form.baseUrl,
          model: form.model,
          temperature: form.temperature,
          maxTokens: form.maxTokens,
          isDefault: form.isDefault,
          isEnabled: form.isEnabled,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save config');
      }

      alert(editingConfig ? '配置已更新' : '新配置已创建');
      setDialogOpen(false);
      setEditingConfig(null);
      setForm(defaultForm);
      loadConfigs();
    } catch (error) {
      console.error('Failed to save config:', error);
      alert('无法保存配置');
    }
  };

  const handleEdit = (config: LLMConfig) => {
    setEditingConfig(config);
    setForm({
      id: config.id,
      name: config.name,
      provider: config.provider,
      apiKey: '', // 需要重新输入
      baseUrl: config.base_url || '',
      model: config.model,
      temperature: config.temperature ?? 0.7,
      maxTokens: config.max_tokens ?? 4096,
      isDefault: config.is_default,
      isEnabled: config.is_enabled,
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除此配置吗？')) return;

    try {
      const response = await fetch(`/api/llm-config?id=${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete config');
      }

      alert('配置已删除');
      loadConfigs();
    } catch (error) {
      console.error('Failed to delete config:', error);
      alert('无法删除配置');
    }
  };

  const handleTest = async (configId: string) => {
    setTesting(true);

    try {
      const response = await fetch('/api/llm-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ configId }),
      });

      const data = await response.json();

      if (response.ok) {
        alert(`测试成功！响应时间: ${data.responseTime}ms`);
      } else {
        alert(`测试失败: ${data.error}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : '未知错误';
      alert(`测试失败: ${message}`);
    } finally {
      setTesting(false);
      loadStats();
    }
  };

  const getProviderName = (providerId: string) => {
    return providers.find(p => p.id === providerId)?.name || providerId;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 统计卡片 */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">{stats.totalRequests}</div>
              <div className="text-sm text-muted-foreground">总请求数</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">{stats.totalTokens.toLocaleString()}</div>
              <div className="text-sm text-muted-foreground">总Token数</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-green-600">{stats.successCount}</div>
              <div className="text-sm text-muted-foreground">成功请求</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-red-600">{stats.failureCount}</div>
              <div className="text-sm text-muted-foreground">失败请求</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* 配置列表 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                LLM 配置管理
              </CardTitle>
              <CardDescription>
                管理大语言模型API配置，支持多种主流模型
              </CardDescription>
            </div>
            <Button
              onClick={() => {
                setEditingConfig(null);
                setForm(defaultForm);
                setDialogOpen(true);
              }}
            >
              <Plus className="h-4 w-4 mr-2" />
              添加配置
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {configs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <AlertCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>暂无LLM配置</p>
              <p className="text-sm mt-2">请添加至少一个模型配置以使用AI功能</p>
            </div>
          ) : (
            <div className="space-y-4">
              {configs.map((config) => (
                <Card key={config.id} className={config.is_default ? 'border-primary' : ''}>
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold">{config.name}</h3>
                          {config.is_default && (
                            <Badge variant="default">
                              <Zap className="h-3 w-3 mr-1" />
                              默认
                            </Badge>
                          )}
                          {!config.is_enabled && (
                            <Badge variant="secondary">已禁用</Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span>{getProviderName(config.provider)}</span>
                          <span>•</span>
                          <span>{config.model}</span>
                          {config.base_url && (
                            <>
                              <span>•</span>
                              <span className="truncate max-w-[200px]">{config.base_url}</span>
                            </>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          API Key: {config.api_key}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleTest(config.id)}
                          disabled={testing}
                        >
                          {testing ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <RefreshCw className="h-4 w-4" />
                          )}
                          <span className="ml-2">测试</span>
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEdit(config)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDelete(config.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 配置对话框 */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingConfig ? '编辑配置' : '添加新配置'}
            </DialogTitle>
            <DialogDescription>
              配置大语言模型API，支持多种主流模型提供商
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">配置名称 *</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="例如: DeepSeek 生产环境"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="provider">提供商 *</Label>
              <Select value={form.provider} onValueChange={handleProviderChange}>
                <SelectTrigger>
                  <SelectValue placeholder="选择提供商" />
                </SelectTrigger>
                <SelectContent>
                  {providers.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="apiKey">API 密钥 *</Label>
              <div className="relative">
                <Input
                  id="apiKey"
                  type={showApiKey ? 'text' : 'password'}
                  value={form.apiKey}
                  onChange={(e) => setForm({ ...form, apiKey: e.target.value })}
                  placeholder="sk-..."
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full"
                  onClick={() => setShowApiKey(!showApiKey)}
                >
                  {showApiKey ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            {form.provider === 'custom' && (
              <div className="space-y-2">
                <Label htmlFor="baseUrl">API 端点 *</Label>
                <Input
                  id="baseUrl"
                  value={form.baseUrl}
                  onChange={(e) => setForm({ ...form, baseUrl: e.target.value })}
                  placeholder="https://api.example.com/v1"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="model">模型 *</Label>
              <Select 
                value={form.model} 
                onValueChange={(v) => setForm({ ...form, model: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择模型" />
                </SelectTrigger>
                <SelectContent>
                  {(providers.find(p => p.id === form.provider)?.availableModels || []).map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="temperature">温度</Label>
                <Input
                  id="temperature"
                  type="number"
                  min={0}
                  max={2}
                  step={0.1}
                  value={form.temperature}
                  onChange={(e) => setForm({ ...form, temperature: parseFloat(e.target.value) })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="maxTokens">最大Token</Label>
                <Input
                  id="maxTokens"
                  type="number"
                  min={1}
                  value={form.maxTokens}
                  onChange={(e) => setForm({ ...form, maxTokens: parseInt(e.target.value) })}
                />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Switch
                  id="isDefault"
                  checked={form.isDefault}
                  onCheckedChange={(checked) => setForm({ ...form, isDefault: checked })}
                />
                <Label htmlFor="isDefault">设为默认</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="isEnabled"
                  checked={form.isEnabled}
                  onCheckedChange={(checked) => setForm({ ...form, isEnabled: checked })}
                />
                <Label htmlFor="isEnabled">启用</Label>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleSubmit}>
              {editingConfig ? '保存' : '创建'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
