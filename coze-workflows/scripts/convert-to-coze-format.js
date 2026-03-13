#!/usr/bin/env node

/**
 * Coze工作流快速导入脚本
 * 
 * 使用方法：
 * 1. 安装依赖：npm install axios
 * 2. 配置环境变量：COZE_API_KEY=your_api_key
 * 3. 运行脚本：node import-to-coze.js
 */

const fs = require('fs');
const path = require('path');
const axios = require('axios');

// 配置
const COZE_API_BASE = 'https://api.coze.cn/v1';
const WORKFLOWS_DIR = path.join(__dirname, '..');

// 颜色输出
const colors = {
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  reset: '\x1b[0m'
};

function log(message, type = 'info') {
  const color = type === 'success' ? colors.green : type === 'error' ? colors.red : colors.yellow;
  console.log(`${color}${message}${colors.reset}`);
}

/**
 * 读取工作流配置文件
 */
function readWorkflowConfigs() {
  const configs = {};
  const files = fs.readdirSync(WORKFLOWS_DIR)
    .filter(f => f.endsWith('.json') && f !== 'bot-config.json');

  files.forEach(file => {
    const filePath = path.join(WORKFLOWS_DIR, file);
    const content = fs.readFileSync(filePath, 'utf-8');
    const config = JSON.parse(content);
    configs[config.name] = {
      file,
      config
    };
  });

  return configs;
}

/**
 * 转换为Coze API格式
 */
function convertToCozeFormat(workflowConfig) {
  return {
    name: workflowConfig.name,
    description: workflowConfig.description,
    version: workflowConfig.version,
    nodes: workflowConfig.nodes.map(node => {
      // 转换节点类型
      const cozeNode = {
        id: node.id,
        type: node.type,
        title: node.title
      };

      // 根据节点类型处理
      switch (node.type) {
        case 'start':
          cozeNode.inputs = node.inputs;
          break;
        case 'llm':
          cozeNode.model = node.model;
          cozeNode.temperature = node.temperature;
          cozeNode.prompt = node.prompt;
          cozeNode.output_parser = node.output_parser;
          break;
        case 'code':
          cozeNode.language = node.language;
          cozeNode.code = node.code;
          break;
        case 'iterator':
          cozeNode.iterate_over = node.iterate_over;
          cozeNode.batch_size = node.batch_size;
          cozeNode.node = node.node;
          break;
        case 'end':
          cozeNode.outputs = node.outputs;
          break;
        default:
          Object.assign(cozeNode, node);
      }

      if (node.next_nodes) {
        cozeNode.next_nodes = node.next_nodes;
      }

      if (node.condition) {
        cozeNode.condition = node.condition;
      }

      return cozeNode;
    }),
    variables: workflowConfig.variables || []
  };
}

/**
 * 导入单个工作流到Coze
 */
async function importWorkflowToCoze(botId, workflowName, workflowConfig, apiKey) {
  try {
    log(`正在导入工作流: ${workflowName}...`);

    const cozeFormat = convertToCozeFormat(workflowConfig);

    const response = await axios.post(
      `${COZE_API_BASE}/bot/${botId}/workflow`,
      cozeFormat,
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      }
    );

    log(`✅ ${workflowName} 导入成功`, 'success');
    return { success: true, data: response.data };
  } catch (error) {
    log(`❌ ${workflowName} 导入失败: ${error.message}`, 'error');
    return { success: false, error: error.message };
  }
}

/**
 * 批量导入所有工作流
 */
async function importAllWorkflows(botId, apiKey) {
  log('开始导入所有工作流...\n');

  const configs = readWorkflowConfigs();
  const results = [];

  for (const [name, { file, config }] of Object.entries(configs)) {
    const result = await importWorkflowToCoze(botId, name, config, apiKey);
    results.push({ name, file, ...result });
    
    // 延迟避免API限流
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  // 输出汇总
  log('\n=== 导入结果汇总 ===');
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);

  log(`成功: ${successful.length}`, 'success');
  log(`失败: ${failed.length}`, failed.length > 0 ? 'error' : 'success');

  if (failed.length > 0) {
    log('\n失败的工作流:');
    failed.forEach(r => {
      log(`  - ${r.name} (${r.file}): ${r.error}`);
    });
  }

  return results;
}

/**
 * 生成工作流预览（用于手动创建）
 */
function generatePreview() {
  log('\n=== 工作流配置预览 ===\n');

  const configs = readWorkflowConfigs();

  for (const [name, { file, config }] of Object.entries(configs)) {
    log(`\n📋 ${name}`);
    log(`   文件: ${file}`);
    log(`   描述: ${config.description}`);
    log(`   节点数: ${config.nodes.length}`);
    log(`   节点类型: ${config.nodes.map(n => n.type).join(' → ')}`);
  }

  log('\n=== 使用说明 ===');
  log('1. 登录 Coze 平台: https://www.coze.cn');
  log('2. 创建或选择一个Bot');
  log('3. 在Bot配置页 → 工作流 → 创建工作流');
  log('4. 按照上述节点配置手动创建');
  log('5. 或使用自动导入（需要API Key）:\n');
  log('   export COZE_API_KEY=your_api_key');
  log('   node import-to-coze.js --bot-id YOUR_BOT_ID --import\n');
}

/**
 * 生成Markdown配置文档（用于手动复制）
 */
function generateMarkdownConfig() {
  const configs = readWorkflowConfigs();
  let markdown = '# Coze 工作流手动配置指南\n\n';
  markdown += '本文档提供每个工作流的详细配置，可直接复制到Coze平台使用。\n\n';
  markdown += '---\n\n';

  for (const [name, { file, config }] of Object.entries(configs)) {
    markdown += `## ${name}\n\n`;
    markdown += `**描述**: ${config.description}\n\n`;
    markdown += `**文件**: \`${file}\`\n\n`;
    markdown += `### 节点配置\n\n`;

    config.nodes.forEach((node, index) => {
      markdown += `#### ${index + 1}. ${node.title} (${node.type})\n\n`;

      // 开始节点
      if (node.type === 'start') {
        markdown += '**输入变量**:\n\n';
        node.inputs.forEach(input => {
          markdown += `- \`${input.name}\` (${input.type})`;
          if (input.required) markdown += ' *必填*';
          markdown += `: ${input.description}`;
          if (input.default) markdown += ` (默认: \`${input.default}\`)`;
          markdown += '\n';
        });
      }

      // LLM节点
      if (node.type === 'llm') {
        markdown += `**模型**: ${node.model}\n\n`;
        markdown += `**Temperature**: ${node.temperature}\n\n`;
        markdown += `**System Prompt**:\n\`\`\`\n${node.prompt.system}\n\`\`\`\n\n`;
        markdown += `**User Prompt**:\n\`\`\`\n${node.prompt.user}\n\`\`\`\n\n`;
      }

      // 代码节点
      if (node.type === 'code') {
        markdown += `**语言**: ${node.language}\n\n`;
        markdown += `**代码**:\n\`\`\`${node.language}\n${node.code}\n\`\`\`\n\n`;
      }

      markdown += '\n';
    });

    markdown += '---\n\n';
  }

  // 保存Markdown文件
  const outputPath = path.join(__dirname, '..', 'MANUAL_CONFIG.md');
  fs.writeFileSync(outputPath, markdown, 'utf-8');
  log(`\n✅ 已生成手动配置文档: ${outputPath}`, 'success');
}

/**
 * 主函数
 */
async function main() {
  const args = process.argv.slice(2);
  const botIdIndex = args.indexOf('--bot-id');
  const importIndex = args.indexOf('--import');
  const previewIndex = args.indexOf('--preview');
  const manualIndex = args.indexOf('--manual');

  // 显示预览
  if (previewIndex !== -1) {
    generatePreview();
    return;
  }

  // 生成手动配置文档
  if (manualIndex !== -1) {
    generateMarkdownConfig();
    return;
  }

  // 导入到Coze
  if (importIndex !== -1 && botIdIndex !== -1) {
    const botId = args[botIdIndex + 1];
    const apiKey = process.env.COZE_API_KEY;

    if (!apiKey) {
      log('❌ 错误: 请设置环境变量 COZE_API_KEY', 'error');
      process.exit(1);
    }

    if (!botId) {
      log('❌ 错误: 请提供 Bot ID', 'error');
      process.exit(1);
    }

    await importAllWorkflows(botId, apiKey);
    return;
  }

  // 显示帮助
  console.log(`
Coze 工作流导入工具

用法:
  node import-to-coze.js [选项]

选项:
  --preview           显示工作流配置预览
  --manual            生成手动配置文档
  --import            导入工作流到Coze (需要 --bot-id 和 COZE_API_KEY)
  --bot-id <id>       指定Bot ID (用于 --import)

示例:
  # 查看预览
  node import-to-coze.js --preview

  # 生成手动配置文档
  node import-to-coze.js --manual

  # 导入到Coze
  export COZE_API_KEY=your_api_key
  node import-to-coze.js --import --bot-id YOUR_BOT_ID
  `);
}

// 运行
main().catch(console.error);
