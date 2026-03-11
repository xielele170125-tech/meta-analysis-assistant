'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Loader2, Send, Settings, Trash2, Sparkles, Brain } from 'lucide-react';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  reasoning?: string;
  isStreaming?: boolean;
}

export default function Home() {
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('deepseek-reasoner');
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // 从本地存储加载 API Key
  useEffect(() => {
    const savedKey = localStorage.getItem('deepseek_api_key');
    if (savedKey) {
      setApiKey(savedKey);
      setShowSettings(false);
    }
  }, []);

  // 自动滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // 保存 API Key
  const saveApiKey = () => {
    if (apiKey.trim()) {
      localStorage.setItem('deepseek_api_key', apiKey);
      setShowSettings(false);
    }
  };

  // 清空对话
  const clearMessages = () => {
    setMessages([]);
  };

  // 发送消息
  const sendMessage = async () => {
    if (!input.trim() || isLoading || !apiKey.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
    };

    const assistantMessage: Message = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: '',
      reasoning: '',
      isStreaming: true,
    };

    setMessages((prev) => [...prev, userMessage, assistantMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, userMessage].map((m) => ({
            role: m.role,
            content: m.content,
          })),
          apiKey,
          model,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || '请求失败');
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('无法读取响应流');
      }

      let fullContent = '';
      let fullReasoning = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') {
              break;
            }

            try {
              const parsed = JSON.parse(data);
              if (parsed.content) {
                fullContent += parsed.content;
              }
              if (parsed.reasoning_content) {
                fullReasoning += parsed.reasoning_content;
              }

              // 更新消息
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMessage.id
                    ? { ...m, content: fullContent, reasoning: fullReasoning }
                    : m
                )
              );
            } catch {
              // 忽略解析错误
            }
          }
        }
      }

      // 标记流式输出结束
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMessage.id ? { ...m, isStreaming: false } : m
        )
      );
    } catch (error) {
      console.error('Error:', error);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMessage.id
            ? {
                ...m,
                content: `错误: ${error instanceof Error ? error.message : '未知错误'}`,
                isStreaming: false,
              }
            : m
        )
      );
    } finally {
      setIsLoading(false);
    }
  };

  // 处理键盘事件
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="flex h-screen flex-col bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      {/* 头部 */}
      <header className="flex items-center justify-between border-b bg-white/80 backdrop-blur-sm dark:bg-slate-900/80 px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 shadow-lg">
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">
              DeepSeek 对话
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              深度推理模型对话助手
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="gap-1">
            <Brain className="h-3 w-3" />
            {model === 'deepseek-reasoner' ? '推理模式' : '对话模式'}
          </Badge>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowSettings(!showSettings)}
            className="text-slate-600 dark:text-slate-300"
          >
            <Settings className="h-5 w-5" />
          </Button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* 设置面板 */}
        {showSettings && (
          <div className="w-80 border-r bg-white dark:bg-slate-900 p-6 flex flex-col gap-4 overflow-auto">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">API 设置</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    API Key
                  </label>
                  <Input
                    type="password"
                    placeholder="输入你的 DeepSeek API Key"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    className="bg-slate-50 dark:bg-slate-800"
                  />
                  <p className="text-xs text-slate-500">
                    从{' '}
                    <a
                      href="https://platform.deepseek.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-500 hover:underline"
                    >
                      DeepSeek 平台
                    </a>{' '}
                    获取
                  </p>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    模型选择
                  </label>
                  <Select value={model} onValueChange={setModel}>
                    <SelectTrigger className="bg-slate-50 dark:bg-slate-800">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="deepseek-reasoner">
                        DeepSeek Reasoner (推理)
                      </SelectItem>
                      <SelectItem value="deepseek-chat">
                        DeepSeek Chat (对话)
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={saveApiKey} className="w-full" disabled={!apiKey.trim()}>
                  保存设置
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-600 dark:text-slate-400">
                    清空对话记录
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={clearMessages}
                    disabled={messages.length === 0}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    清空
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* 主聊天区域 */}
        <main className="flex flex-1 flex-col overflow-hidden">
          {/* 消息列表 */}
          <div className="flex-1 overflow-auto p-6">
            {messages.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center text-center">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 shadow-xl">
                  <Sparkles className="h-8 w-8 text-white" />
                </div>
                <h2 className="mb-2 text-2xl font-bold text-slate-800 dark:text-white">
                  开始对话
                </h2>
                <p className="max-w-md text-slate-500 dark:text-slate-400">
                  {apiKey
                    ? '输入你的问题，体验 DeepSeek 的深度推理能力'
                    : '请先在设置中配置你的 API Key'}
                </p>
              </div>
            ) : (
              <div className="mx-auto max-w-3xl space-y-6">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${
                      message.role === 'user' ? 'justify-end' : 'justify-start'
                    }`}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl px-5 py-3 ${
                        message.role === 'user'
                          ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-lg'
                          : 'bg-white dark:bg-slate-800 shadow-md'
                      }`}
                    >
                      {message.role === 'user' ? (
                        <p className="whitespace-pre-wrap">{message.content}</p>
                      ) : (
                        <div className="space-y-3">
                          {/* 推理过程 */}
                          {message.reasoning && message.reasoning.length > 0 && (
                            <div className="rounded-lg bg-slate-100 dark:bg-slate-700/50 p-3">
                              <div className="mb-2 flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                                <Brain className="h-3 w-3" />
                                推理过程
                              </div>
                              <p className="whitespace-pre-wrap text-sm text-slate-600 dark:text-slate-300">
                                {message.reasoning}
                              </p>
                            </div>
                          )}
                          {/* 回答内容 */}
                          <div className="text-slate-800 dark:text-slate-200">
                            {message.content || (
                              <div className="flex items-center gap-2">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                <span className="text-slate-500">
                                  正在思考中...
                                </span>
                              </div>
                            )}
                          </div>
                          {message.isStreaming && message.content && (
                            <span className="inline-block h-4 w-1 animate-pulse bg-blue-500 rounded-full" />
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          {/* 输入区域 */}
          <div className="border-t bg-white/80 backdrop-blur-sm dark:bg-slate-900/80 p-4">
            <div className="mx-auto max-w-3xl">
              <div className="flex gap-3">
                <Textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={
                    apiKey
                      ? '输入你的问题... (Enter 发送, Shift+Enter 换行)'
                      : '请先配置 API Key'
                  }
                  disabled={isLoading || !apiKey}
                  className="min-h-[60px] max-h-[200px] resize-none bg-slate-50 dark:bg-slate-800"
                  rows={1}
                />
                <Button
                  onClick={sendMessage}
                  disabled={isLoading || !input.trim() || !apiKey}
                  className="h-auto px-6 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
                >
                  {isLoading ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <Send className="h-5 w-5" />
                  )}
                </Button>
              </div>
              <p className="mt-2 text-center text-xs text-slate-400">
                DeepSeek {model === 'deepseek-reasoner' ? 'Reasoner' : 'Chat'} ·
                支持流式输出
              </p>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
