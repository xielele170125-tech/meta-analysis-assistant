/**
 * 工作流Prompt快速复制工具
 * 用于快速获取各工作流的Prompt配置
 */

const fs = require('fs');
const path = require('path');

const WORKFLOWS_DIR = path.join(__dirname, '..');

function extractPrompts() {
  const prompts = {};
  const files = fs.readdirSync(WORKFLOWS_DIR)
    .filter(f => f.endsWith('.json') && f !== 'bot-config.json');

  files.forEach(file => {
    const filePath = path.join(WORKFLOWS_DIR, file);
    const content = fs.readFileSync(filePath, 'utf-8');
    const config = JSON.parse(content);

    const workflowPrompts = {};

    config.nodes.forEach(node => {
      if (node.type === 'llm' && node.prompt) {
        workflowPrompts[node.id] = {
          title: node.title,
          model: node.model,
          temperature: node.temperature,
          system: node.prompt.system,
          user: node.prompt.user
        };
      }
    });

    if (Object.keys(workflowPrompts).length > 0) {
      prompts[config.name] = {
        description: config.description,
        prompts: workflowPrompts
      };
    }
  });

  return prompts;
}

function generateQuickCopyMarkdown() {
  const prompts = extractPrompts();
  let markdown = '# Coze 工作流 Prompt 快速复制\n\n';
  markdown += '本文档包含所有工作流的Prompt配置，可直接复制到Coze平台使用。\n\n';
  markdown += '---\n\n';

  for (const [workflowName, { description, prompts }] of Object.entries(prompts)) {
    markdown += `## ${workflowName}\n\n`;
    markdown += `${description}\n\n`;

    for (const [nodeId, promptConfig] of Object.entries(prompts)) {
      markdown += `### ${promptConfig.title}\n\n`;
      markdown += `**模型**: ${promptConfig.model}\n\n`;
      markdown += `**Temperature**: ${promptConfig.temperature}\n\n`;
      
      markdown += `**System Prompt** (复制以下内容):\n\n`;
      markdown += '```\n';
      markdown += promptConfig.system;
      markdown += '\n```\n\n';

      if (promptConfig.user) {
        markdown += `**User Prompt** (复制以下内容):\n\n`;
        markdown += '```\n';
        markdown += promptConfig.user;
        markdown += '\n```\n\n';
      }

      markdown += '---\n\n';
    }
  }

  // 保存
  const outputPath = path.join(WORKFLOWS_DIR, 'PROMPTS.md');
  fs.writeFileSync(outputPath, markdown, 'utf-8');
  console.log(`✅ 已生成Prompt文档: ${outputPath}`);

  return markdown;
}

// 执行
generateQuickCopyMarkdown();
