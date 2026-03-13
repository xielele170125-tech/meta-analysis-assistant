#!/usr/bin/env node

/**
 * 快速导入脚本
 * 
 * 使用方法：
 * 1. 编辑 import-config.env 文件，填写您的API Key和Bot ID
 * 2. 运行: node quick-import.js
 */

const fs = require('fs');
const path = require('path');
const axios = require('axios');

const CONFIG_FILE = path.join(__dirname, '..', 'import-config.env');
const WORKFLOWS_DIR = path.join(__dirname, '..');

// 颜色输出
const colors = {
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m'
};

function log(message, type = 'info') {
  const color = {
    success: colors.green,
    error: colors.red,
    warning: colors.yellow,
    info: colors.blue,
    highlight: colors.cyan
  }[type] || colors.reset;
  console.log(`${color}${message}${colors.reset}`);
}

/**
 * 解析配置文件
 */
function parseConfig() {
  if (!fs.existsSync(CONFIG_FILE)) {
    log('❌ 配置文件不存在: import-config.env', 'error');
    log('\n请按照以下步骤操作：', 'info');
    log('1. 复制 import-config.env.example 为 import-config.env', 'info');
    log('2. 编辑文件，填写您的API Key和Bot ID', 'info');
    log('3. 重新运行此脚本', 'info');
    return null;
  }

  const content = fs.readFileSync(CONFIG_FILE, 'utf-8');
  const config = {};

  content.split('\n').forEach(line => {
    line = line.trim();
    if (line && !line.startsWith('#')) {
      const [key, ...valueParts] = line.split('=');
      if (key && valueParts.length > 0) {
        config[key.trim()] = valueParts.join('=').trim();
      }
    }
  });

  return config;
}

/**
 * 验证配置
 */
function validateConfig(config) {
  const errors = [];

  if (!config.COZE_API_KEY || config.COZE_API_KEY === 'your_api_key_here') {
    errors.push('请在 import-config.env 中填写 COZE_API_KEY');
  }

  if (config.CREATE_NEW_BOT !== 'true') {
    if (!config.BOT_ID || config.BOT_ID === 'your_bot_id_here') {
      errors.push('请在 import-config.env 中填写 BOT_ID，或设置 CREATE_NEW_BOT=true');
    }
  }

  return errors;
}

/**
 * 创建Bot
 */
async function createBot(apiKey, botName, apiBase) {
  try {
    log(`\n正在创建Bot "${botName}"...`, 'info');
    const response = await axios.post(`${apiBase}/bots`, {
      name: botName,
      description: '专业的医学文献Meta分析AI助手，支持检索式生成、文献筛选、数据提取、质量评分和Meta分析'
    }, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });
    log(`✅ Bot创建成功！`, 'success');
    log(`Bot ID: ${response.data.id}`, 'highlight');
    return response.data.id;
  } catch (error) {
    log(`创建Bot失败: ${error.response?.data?.message || error.message}`, 'error');
    return null;
  }
}

/**
 * 验证API Key
 */
async function verifyApiKey(apiKey, apiBase) {
  try {
    log('\n正在验证API Key...', 'info');
    await axios.get(`${apiBase}/bots`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      params: { page_size: 1 }
    });
    log('✅ API Key验证成功！', 'success');
    return true;
  } catch (error) {
    if (error.response?.status === 401) {
      log('❌ API Key无效或已过期', 'error');
    } else {
      log(`❌ 验证失败: ${error.message}`, 'error');
    }
    return false;
  }
}

/**
 * 转换为Coze格式
 */
function convertToCozeFormat(workflowConfig) {
  return {
    name: workflowConfig.name,
    description: workflowConfig.description,
    version: workflowConfig.version,
    nodes: workflowConfig.nodes.map(node => {
      const cozeNode = {
        id: node.id,
        type: node.type,
        title: node.title
      };

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

      if (node.next_nodes) cozeNode.next_nodes = node.next_nodes;
      if (node.condition) cozeNode.condition = node.condition;

      return cozeNode;
    }),
    variables: workflowConfig.variables || []
  };
}

/**
 * 导入工作流
 */
async function importWorkflow(apiKey, botId, workflowName, workflowConfig, apiBase) {
  try {
    const cozeFormat = convertToCozeFormat(workflowConfig);
    
    const response = await axios.post(
      `${apiBase}/bots/${botId}/workflows`,
      cozeFormat,
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      }
    );

    log(`  ✅ ${workflowName}`, 'success');
    return { success: true };
  } catch (error) {
    const errorMsg = error.response?.data?.message || error.message;
    log(`  ❌ ${workflowName}: ${errorMsg}`, 'error');
    return { success: false, error: errorMsg };
  }
}

/**
 * 导入所有工作流
 */
async function importAllWorkflows(config) {
  const apiKey = config.COZE_API_KEY;
  const apiBase = config.COZE_API_BASE || 'https://api.coze.cn/v1';
  
  // 验证API Key
  const isValid = await verifyApiKey(apiKey, apiBase);
  if (!isValid) return;

  // 获取或创建Bot ID
  let botId = config.BOT_ID;
  
  if (config.CREATE_NEW_BOT === 'true') {
    botId = await createBot(apiKey, config.NEW_BOT_NAME || '文献Meta分析助手', apiBase);
    if (!botId) return;
  }

  // 导入工作流
  log('\n开始导入工作流...\n', 'highlight');
  
  const files = fs.readdirSync(WORKFLOWS_DIR)
    .filter(f => f.endsWith('.json') && f !== 'bot-config.json');

  const results = [];

  for (const file of files) {
    const filePath = path.join(WORKFLOWS_DIR, file);
    const content = fs.readFileSync(filePath, 'utf-8');
    const workflowConfig = JSON.parse(content);
    
    const result = await importWorkflow(apiKey, botId, workflowConfig.name, workflowConfig, apiBase);
    results.push({ name: workflowConfig.name, ...result });
    
    // 延迟避免API限流
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  // 输出汇总
  log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'info');
  log('导入结果汇总', 'highlight');
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'info');
  
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);

  log(`\n成功: ${successful.length}/${results.length}`, 'success');
  
  if (failed.length > 0) {
    log(`失败: ${failed.length}`, 'error');
    failed.forEach(r => {
      log(`  - ${r.name}: ${r.error}`, 'error');
    });
  }

  // 后续步骤
  if (successful.length > 0) {
    log('\n\n🎉 导入完成！', 'success');
    log('\n接下来的步骤：', 'highlight');
    log(`1. 访问 https://www.coze.cn/bot/${botId}`, 'info');
    log('2. 配置Bot的人设（参考 bot-config.json）', 'info');
    log('3. 测试各个工作流', 'info');
    log('4. 发布Bot到商店', 'info');
  }
}

/**
 * 主函数
 */
async function main() {
  console.log(`
${colors.cyan}╔══════════════════════════════════════════════════════════╗
║                                                          ║
║       📚 Coze 工作流快速导入                             ║
║                                                          ║
╚══════════════════════════════════════════════════════════╝${colors.reset}
  `);

  // 读取配置
  const config = parseConfig();
  if (!config) {
    process.exit(1);
  }

  // 验证配置
  const errors = validateConfig(config);
  if (errors.length > 0) {
    log('\n配置错误：', 'error');
    errors.forEach(err => log(`  - ${err}`, 'error'));
    process.exit(1);
  }

  // 执行导入
  await importAllWorkflows(config);
}

// 运行
main().catch(error => {
  log(`\n❌ 发生错误: ${error.message}`, 'error');
  process.exit(1);
});
