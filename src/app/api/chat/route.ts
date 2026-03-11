import { NextRequest } from 'next/server';
import OpenAI from 'openai';

export const runtime = 'edge';

// 扩展类型以支持 DeepSeek 的 reasoning_content
interface DeepSeekDelta {
  content?: string;
  reasoning_content?: string;
  role?: string;
}

interface DeepSeekStreamChunk {
  choices: Array<{
    delta: DeepSeekDelta;
    finish_reason: string | null;
  }>;
}

export async function POST(request: NextRequest) {
  try {
    const { messages, apiKey, model = 'deepseek-reasoner' } = await request.json();

    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: '请提供 API Key' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response(
        JSON.stringify({ error: '请提供有效的消息' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const openai = new OpenAI({
      baseURL: 'https://api.deepseek.com/v1',
      apiKey: apiKey,
    });

    // 使用流式输出
    const stream = await openai.chat.completions.create({
      messages: messages,
      model: model,
      stream: true,
    });

    // 创建可读流用于 SSE 响应
    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            const deepseekChunk = chunk as unknown as DeepSeekStreamChunk;
            const delta = deepseekChunk.choices[0]?.delta;
            
            // DeepSeek Reasoner 模型会返回 reasoning_content 和 content
            const data = {
              reasoning_content: delta?.reasoning_content || '',
              content: delta?.content || '',
            };

            // 发送 SSE 格式数据
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
          }
          
          // 发送结束标记
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        } catch (error) {
          controller.error(error);
        }
      },
    });

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error: unknown) {
    console.error('DeepSeek API Error:', error);
    
    if (error instanceof Error) {
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    return new Response(
      JSON.stringify({ error: '未知错误' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
