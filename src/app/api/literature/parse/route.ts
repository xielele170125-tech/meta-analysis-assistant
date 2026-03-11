import { NextRequest, NextResponse } from 'next/server';
import { FetchClient, Config, HeaderUtils } from 'coze-coding-dev-sdk';

export async function POST(request: NextRequest) {
  try {
    const { fileUrl, literatureId } = await request.json();

    if (!fileUrl) {
      return NextResponse.json({ error: '请提供文件URL' }, { status: 400 });
    }

    // 使用 FetchClient 解析文档
    const config = new Config();
    const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);
    const client = new FetchClient(config, customHeaders);

    const response = await client.fetch(fileUrl);

    if (response.status_code !== 0) {
      return NextResponse.json(
        { error: response.status_message || '解析失败' },
        { status: 500 }
      );
    }

    // 提取文本内容
    const textContent = response.content
      .filter((item) => item.type === 'text')
      .map((item) => item.text)
      .join('\n');

    return NextResponse.json({
      success: true,
      data: {
        title: response.title,
        content: textContent,
        docId: response.doc_id,
        fileType: response.filetype,
      },
    });
  } catch (error) {
    console.error('Parse error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '解析失败' },
      { status: 500 }
    );
  }
}
