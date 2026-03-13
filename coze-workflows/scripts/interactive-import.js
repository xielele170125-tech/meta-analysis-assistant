#!/usr/bin/env node

/**
 * Coze 工作流交互式导入助手
 * 
 * 这个脚本会引导您完成整个导入过程
 */

const fs = require('fs');
const path = require('path');
const axios = require('axios');
const readline = require('readline');

const COZE_API_BASE = 'https://api.coze.cn/v1';
const WORKFLOWS_DIR = path.join(__dirname, '..');

// 创建readline接口
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

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

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

async function checkApiKey(apiKey) {
  try {
    log('\n正在验证API Key...', 'info');
    const response = await axios.get(`${COZE_API_BASE}/bots`, {
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

async function getBots(apiKey) {
  try {
    const response = await axios.get(`${COZE_API_BASE}/bots`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      params: { page_size: 50 }
    });
    return response.data.data || [];
  } catch (error) {
    log(`获取Bot列表失败: ${error.message}`, 'error');
    return [];
  }
}

async function createBot(apiKey, botName) {
  try {
    log(`\n正在创建Bot "${botName}"...`, 'info');
    const response = await axios.post(`${COZE_API_BASE}/bots`, {
      name: botName,
      description: '专业的医学文献Meta分析AI助手',
      icon_url: 'https://lf-coze-web-cdn.zjcdn.com/obj/static/coze-sdk/asset/icon_48.png'
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

async function importWorkflow(apiKey, botId, workflowName, workflowConfig) {
  try {
    log(`  正在导入: ${workflowName}...`, 'info');
    
    const response = await axios.post(
      `${COZE_API_BASE}/bots/${botId}/workflows`,
      workflowConfig,
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      }
    );

    log(`  ✅ ${workflowName} 导入成功`, 'success');
    return { success: true, data: response.data };
  } catch (error) {
    const errorMsg = error.response?.data?.message || error.message;
    log(`  ❌ ${workflowName} 导入失败: ${errorMsg}`, 'error');
    return { success: false, error: errorMsg };
  }
}

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

async function importAllWorkflows(apiKey, botId) {
  log('\n开始导入所有工作流...\n', 'info');
  
  const files = fs.readdirSync(WORKFLOWS_DIR)
    .filter(f => f.endsWith('.json') && f !== 'bot-config.json');

  const results = [];

  for (const file of files) {
    const filePath = path.join(WORKFLOWS_DIR, file);
    const content = fs.readFileSync(filePath, 'utf-8');
    const config = JSON.parse(content);
    
    const cozeFormat = convertToCozeFormat(config);
    const result = await importWorkflow(apiKey, botId, config.name, cozeFormat);
    results.push({ name: config.name, file, ...result });
    
    // 延迟避免API限流
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  // 输出汇总
  log('\n=== 导入结果汇总 ===', 'highlight');
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);

  log(`成功: ${successful.length}`, 'success');
  log(`失败: ${failed.length}`, failed.length > 0 ? 'error' : 'success');

  if (failed.length > 0) {
    log('\n失败的工作流:', 'warning');
    failed.forEach(r => {
      log(`  - ${r.name}: ${r.error}`, 'error');
    });
  }

  return results;
}

async function main() {
  console.log(`
${colors.cyan}╔══════════════════════════════════════════════════════════╗
║                                                          ║
║       📚 Coze 工作流导入助手                             ║
║                                                          ║
║   将Meta分析智能体工作流导入到您的Coze Bot               ║
║                                                          ║
╚══════════════════════════════════════════════════════════╝${colors.reset}
  `);

  // 第一步：获取API Key
  log('第一步：配置API Key', 'highlight');
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'info');
  
  let apiKey = process.env.COZE_API_KEY;
  
  if (apiKey) {
    log(`\n检测到环境变量中的API Key: ${apiKey.substring(0, 10)}...`, 'info');
    const useExisting = await question('是否使用这个API Key？(y/n): ');
    if (useExisting.toLowerCase() !== 'y') {
      apiKey = null;
    }
  }
  
  if (!apiKey) {
    log('\n请按照以下步骤获取API Key：', 'info');
    log('1. 登录 https://www.coze.cn', 'info');
    log('2. 点击右上角头像 → API管理', 'info');
    log('3. 创建或复制API Key\n', 'info');
    
    apiKey = await question('请输入您的API Key: ');
    if (!apiKey.trim()) {
      log('❌ API Key不能为空', 'error');
      rl.close();
      return;
    }
  }

  // 验证API Key
  const isValid = await checkApiKey(apiKey.trim());
  if (!isValid) {
    rl.close();
    return;
  }

  // 第二步：选择或创建Bot
  log('\n\n第二步：选择或创建Bot', 'highlight');
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'info');
  
  const bots = await getBots(apiKey.trim());
  
  if (bots.length > 0) {
    log('\n您现有的Bot列表：', 'info');
    bots.forEach((bot, index) => {
      log(`${index + 1}. ${bot.name} (ID: ${bot.bot_id})`, 'info');
    });
    log(`${bots.length + 1}. 创建新Bot`, 'info');
    
    const choice = await question('\n请选择 (输入数字): ');
    const choiceNum = parseInt(choice);
    
    if (choiceNum === bots.length + 1) {
      // 创建新Bot
      const botName = await question('请输入Bot名称 (默认: 文献Meta分析助手): ');
      const finalName = botName.trim() || '文献Meta分析助手';
      const botId = await createBot(apiKey.trim(), finalName);
      
      if (!botId) {
        rl.close();
        return;
      }
      
      // 导入工作流
      await importAllWorkflows(apiKey.trim(), botId);
    } else if (choiceNum >= 1 && choiceNum <= bots.length) {
      // 选择现有Bot
      const botId = bots[choiceNum - 1].bot_id;
      log(`\n已选择Bot: ${bots[choiceNum - 1].name}`, 'success');
      
      // 导入工作流
      await importAllWorkflows(apiKey.trim(), botId);
    } else {
      log('❌ 无效的选择', 'error');
      rl.close();
      return;
    }
  } else {
    log('\n您还没有创建任何Bot', 'warning');
    const botName = await question('请输入Bot名称 (默认: 文献Meta分析助手): ');
    const finalName = botName.trim() || '文献Meta分析助手';
    const botId = await createBot(apiKey.trim(), finalName);
    
    if (!botId) {
      rl.close();
      return;
    }
    
    // 导入工作流
    await importAllWorkflows(apiKey.trim(), botId);
  }

  log('\n\n🎉 导入完成！', 'success');
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'info');
  log('\n接下来的步骤：', 'highlight');
  log('1. 访问 https://www.coze.cn 进入您的Bot', 'info');
  log('2. 配置Bot的人设和回复逻辑（参考 bot-config.json）', 'info');
  log('3. 测试各个工作流功能', 'info');
  log('4. 发布Bot到商店或其他平台', 'info');
  
  rl.close();
}

// 运行
main().catch(error => {
  log(`\n❌ 发生错误: ${error.message}`, 'error');
  rl.close();
});
