/**
 * 网状Meta分析核心算法库
 * 
 * 支持：
 * - 网状结构构建与分析
 * - 间接比较计算（Bucher方法）
 * - SUCRA排名计算
 * - 一致性检验
 */

// ==================== 类型定义 ====================

/** 干预措施臂数据 */
export interface ArmData {
  interventionId: string;
  interventionName: string;
  sampleSize: number;
  events?: number;      // 二分类变量
  mean?: number;        // 连续变量
  sd?: number;          // 连续变量
}

/** 研究数据（多臂试验） */
export interface StudyData {
  studyName: string;
  year?: number;
  arms: ArmData[];
  outcomeType: string;
}

/** 直接比较结果 */
export interface DirectComparison {
  interventionA: string;
  interventionB: string;
  studyName: string;
  effectSize: number;     // 对数OR或SMD
  standardError: number;
  ciLower: number;
  ciUpper: number;
  sampleSizeA: number;
  sampleSizeB: number;
  eventsA?: number;
  eventsB?: number;
}

/** 网状比较结果 */
export interface NetworkComparison {
  interventionA: string;
  interventionB: string;
  networkEffectSize: number;
  networkStandardError: number;
  networkCiLower: number;
  networkCiUpper: number;
  pValue: number;
  comparisonType: 'direct' | 'indirect' | 'network';
  directEffectSize?: number;
  directStandardError?: number;
  indirectEffectSize?: number;
  indirectStandardError?: number;
  inconsistencyPValue?: number;
}

/** 治疗排名 */
export interface TreatmentRanking {
  intervention: string;
  sucra: number;           // 0-1, 越大越好
  meanRank: number;
  rankProbabilities: number[];
  numberOfStudies: number;
}

/** 网状结构节点 */
export interface NetworkNode {
  id: string;
  name: string;
  numberOfStudies: number;
  sampleSize: number;
}

/** 网状结构边 */
export interface NetworkEdge {
  source: string;
  target: string;
  numberOfStudies: number;
  totalSampleSize: number;
  effectSize?: number;
  ciLower?: number;
  ciUpper?: number;
}

/** 网状结构 */
export interface NetworkStructure {
  nodes: NetworkNode[];
  edges: NetworkEdge[];
  numberOfInterventions: number;
  numberOfComparisons: number;
  numberOfStudies: number;
  hasLoops: boolean;
  connectivity: 'connected' | 'disconnected';
}

/** 一致性检验结果 */
export interface ConsistencyResult {
  testMethod: 'bucher' | 'nodesplit' | 'designbytreatment';
  loop?: string[];
  directEffect: number;
  indirectEffect: number;
  difference: number;
  differenceSe: number;
  consistencyPValue: number;
  isConsistent: boolean;
  conclusion: string;
}

/** 分析配置 */
export interface AnalysisConfig {
  effectMeasure: 'OR' | 'RR' | 'RD' | 'MD' | 'SMD' | 'HR';
  modelType: 'fixed' | 'random';
  referenceIntervention?: string;
  confidenceLevel: number;  // 默认 0.95
}

// ==================== 统计工具函数 ====================

/** 标准正态分布CDF */
function normalCDF(x: number): number {
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x) / Math.sqrt(2);

  const t = 1.0 / (1.0 + p * x);
  const y = 1.0 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

  return 0.5 * (1.0 + sign * y);
}

/** Z分数转P值（双尾） */
function zToPValue(z: number): number {
  return 2 * (1 - normalCDF(Math.abs(z)));
}

/** 卡方分布CDF */
function chiSquareCDF(x: number, df: number): number {
  if (x <= 0) return 0;
  // 使用Gamma函数近似
  return regularizedGammaP(df / 2, x / 2);
}

/** 正则化Gamma函数（不完全） */
function regularizedGammaP(a: number, x: number): number {
  if (x <= 0 || a <= 0) return 0;
  
  const maxIterations = 200;
  const epsilon = 1e-10;
  
  if (x < a + 1) {
    // 使用级数展开
    let sum = 1.0;
    let term = 1.0;
    for (let n = 1; n < maxIterations; n++) {
      term *= x / (a + n - 1);
      sum += term;
      if (Math.abs(term) < epsilon * Math.abs(sum)) break;
    }
    return sum * Math.exp(-x + a * Math.log(x) - logGamma(a));
  } else {
    // 使用连分数展开
    const g = 7;
    const c = [
      0.99999999999980993,
      676.5203681218851,
      -1259.1392167224028,
      771.32342877765313,
      -176.61502916214059,
      12.507343278686905,
      -0.13857109526572012,
      9.9843695780195716e-6,
      1.5056327351493116e-7
    ];
    
    let y = x;
    for (let n = g; n >= 2; n--) {
      y = y - a + (c[n] * y) / (y + n - a);
    }
    return 1 - Math.exp(-x + a * Math.log(x) - logGamma(a)) * y;
  }
}

/** 对数Gamma函数 */
function logGamma(x: number): number {
  const c = [
    76.18009172947146,
    -86.50532032941677,
    24.01409824083091,
    -1.231739572450155,
    0.1208650973866179e-2,
    -0.5395239384953e-5
  ];
  
  let y = x + 5.5;
  y -= (x + 0.5) * Math.log(y);
  
  let sum = 1.000000000190015;
  for (let i = 0; i < 6; i++) {
    sum += c[i] / (x + i + 1);
  }
  
  return -y + Math.log(2.5066282746310005 * sum / x);
}

// ==================== 效应量计算 ====================

/**
 * 计算二分类变量的效应量（对数OR）
 */
export function calculateBinaryEffectSize(
  eventsA: number,
  totalA: number,
  eventsB: number,
  totalB: number
): { effectSize: number; standardError: number } {
  // 添加0.5连续性校正
  const a = eventsA + 0.5;
  const b = totalA - eventsA + 0.5;
  const c = eventsB + 0.5;
  const d = totalB - eventsB + 0.5;
  
  // 对数优势比
  const logOR = Math.log((a * d) / (b * c));
  
  // 标准误
  const se = Math.sqrt(1 / a + 1 / b + 1 / c + 1 / d);
  
  return { effectSize: logOR, standardError: se };
}

/**
 * 计算连续变量的效应量（SMD - Hedges' g）
 */
export function calculateContinuousEffectSize(
  meanA: number,
  sdA: number,
  nA: number,
  meanB: number,
  sdB: number,
  nB: number
): { effectSize: number; standardError: number } {
  // 合并标准差
  const pooledSD = Math.sqrt(
    ((nA - 1) * sdA * sdA + (nB - 1) * sdB * sdB) / (nA + nB - 2)
  );
  
  // Cohen's d
  const d = (meanB - meanA) / pooledSD;
  
  // Hedges' g 校正因子
  const correctionFactor = 1 - 3 / (4 * (nA + nB) - 9);
  const g = d * correctionFactor;
  
  // 标准误
  const se = Math.sqrt((nA + nB) / (nA * nB) + g * g / (2 * (nA + nB)));
  
  return { effectSize: g, standardError: se };
}

// ==================== 直接比较提取 ====================

/**
 * 从多臂试验数据中提取所有两两比较
 */
export function extractDirectComparisons(
  studies: StudyData[],
  config: AnalysisConfig
): DirectComparison[] {
  const comparisons: DirectComparison[] = [];
  
  for (const study of studies) {
    const { arms } = study;
    
    // 提取所有两两比较
    for (let i = 0; i < arms.length; i++) {
      for (let j = i + 1; j < arms.length; j++) {
        const armA = arms[i];
        const armB = arms[j];
        
        let effectSize: number;
        let standardError: number;
        let eventsA: number | undefined;
        let eventsB: number | undefined;
        
        // 根据数据类型计算效应量
        if (armA.events !== undefined && armB.events !== undefined) {
          // 二分类变量
          const result = calculateBinaryEffectSize(
            armA.events,
            armA.sampleSize,
            armB.events,
            armB.sampleSize
          );
          effectSize = result.effectSize;
          standardError = result.standardError;
          eventsA = armA.events;
          eventsB = armB.events;
        } else if (
          armA.mean !== undefined && armA.sd !== undefined &&
          armB.mean !== undefined && armB.sd !== undefined
        ) {
          // 连续变量
          const result = calculateContinuousEffectSize(
            armA.mean,
            armA.sd,
            armA.sampleSize,
            armB.mean,
            armB.sd,
            armB.sampleSize
          );
          effectSize = result.effectSize;
          standardError = result.standardError;
        } else {
          continue; // 跳过无法计算的数据
        }
        
        const z = 1.96; // 95% CI
        
        comparisons.push({
          interventionA: armA.interventionName,
          interventionB: armB.interventionName,
          studyName: study.studyName,
          effectSize,
          standardError,
          ciLower: effectSize - z * standardError,
          ciUpper: effectSize + z * standardError,
          sampleSizeA: armA.sampleSize,
          sampleSizeB: armB.sampleSize,
          eventsA,
          eventsB,
        });
      }
    }
  }
  
  return comparisons;
}

/**
 * 合并同一比较对的多个研究结果
 */
export function poolDirectComparisons(
  comparisons: DirectComparison[],
  modelType: 'fixed' | 'random' = 'random'
): Map<string, DirectComparison> {
  // 按干预对分组
  const groups = new Map<string, DirectComparison[]>();
  
  for (const comp of comparisons) {
    // 标准化比较对（按字母顺序）
    const key = comp.interventionA < comp.interventionB
      ? `${comp.interventionA}|${comp.interventionB}`
      : `${comp.interventionB}|${comp.interventionA}`;
    
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(comp);
  }
  
  const pooledComparisons = new Map<string, DirectComparison>();
  
  for (const [key, comps] of groups) {
    const [intA, intB] = key.split('|');
    
    if (comps.length === 1) {
      pooledComparisons.set(key, comps[0]);
    } else {
      // 合并多个研究
      const pooled = poolStudies(comps, modelType);
      pooledComparisons.set(key, {
        ...pooled,
        interventionA: intA,
        interventionB: intB,
        studyName: `${comps.length} studies`,
      });
    }
  }
  
  return pooledComparisons;
}

/**
 * 合并多个研究（固定/随机效应模型）
 */
function poolStudies(
  comparisons: DirectComparison[],
  modelType: 'fixed' | 'random'
): Omit<DirectComparison, 'interventionA' | 'interventionB' | 'studyName'> {
  // 计算权重
  const weights = comparisons.map(c => 1 / (c.standardError * c.standardError));
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  
  // 固定效应估计
  const fixedEffect = comparisons.reduce((sum, c, i) => sum + weights[i] * c.effectSize, 0) / totalWeight;
  
  if (modelType === 'fixed') {
    const se = Math.sqrt(1 / totalWeight);
    return {
      effectSize: fixedEffect,
      standardError: se,
      ciLower: fixedEffect - 1.96 * se,
      ciUpper: fixedEffect + 1.96 * se,
      sampleSizeA: comparisons.reduce((s, c) => s + c.sampleSizeA, 0),
      sampleSizeB: comparisons.reduce((s, c) => s + c.sampleSizeB, 0),
    };
  }
  
  // 随机效应模型
  const Q = comparisons.reduce((sum, c, i) => sum + weights[i] * Math.pow(c.effectSize - fixedEffect, 2), 0);
  const df = comparisons.length - 1;
  const C = totalWeight;
  const sumWSquared = weights.reduce((s, w) => s + w * w, 0);
  
  // Tau平方
  let tau2 = Math.max(0, (Q - df) / (C - sumWSquared / C));
  
  // 重新计算权重
  const randomWeights = comparisons.map(c => 1 / (c.standardError * c.standardError + tau2));
  const randomTotalWeight = randomWeights.reduce((a, b) => a + b, 0);
  
  const randomEffect = comparisons.reduce((sum, c, i) => sum + randomWeights[i] * c.effectSize, 0) / randomTotalWeight;
  const randomSe = Math.sqrt(1 / randomTotalWeight);
  
  return {
    effectSize: randomEffect,
    standardError: randomSe,
    ciLower: randomEffect - 1.96 * randomSe,
    ciUpper: randomEffect + 1.96 * randomSe,
    sampleSizeA: comparisons.reduce((s, c) => s + c.sampleSizeA, 0),
    sampleSizeB: comparisons.reduce((s, c) => s + c.sampleSizeB, 0),
  };
}

// ==================== 网状结构分析 ====================

/**
 * 构建网状结构
 */
export function buildNetworkStructure(
  studies: StudyData[],
  directComparisons: DirectComparison[]
): NetworkStructure {
  // 提取所有干预措施
  const interventionMap = new Map<string, { numberOfStudies: Set<string>; sampleSize: number }>();
  
  for (const study of studies) {
    for (const arm of study.arms) {
      if (!interventionMap.has(arm.interventionName)) {
        interventionMap.set(arm.interventionName, { numberOfStudies: new Set(), sampleSize: 0 });
      }
      const data = interventionMap.get(arm.interventionName)!;
      data.numberOfStudies.add(study.studyName);
      data.sampleSize += arm.sampleSize;
    }
  }
  
  // 构建节点
  const nodes: NetworkNode[] = Array.from(interventionMap.entries()).map(([name, data]) => ({
    id: name,
    name,
    numberOfStudies: data.numberOfStudies.size,
    sampleSize: data.sampleSize,
  }));
  
  // 提取边
  const edgeMap = new Map<string, { studies: Set<string>; sampleSize: number }>();
  
  for (const comp of directComparisons) {
    const key = comp.interventionA < comp.interventionB
      ? `${comp.interventionA}|${comp.interventionB}`
      : `${comp.interventionB}|${comp.interventionA}`;
    
    if (!edgeMap.has(key)) {
      edgeMap.set(key, { studies: new Set(), sampleSize: 0 });
    }
    const data = edgeMap.get(key)!;
    data.studies.add(comp.studyName);
    data.sampleSize += comp.sampleSizeA + comp.sampleSizeB;
  }
  
  const edges: NetworkEdge[] = Array.from(edgeMap.entries()).map(([key, data]) => {
    const [source, target] = key.split('|');
    return {
      source,
      target,
      numberOfStudies: data.studies.size,
      totalSampleSize: data.sampleSize,
    };
  });
  
  // 检测闭合环
  const hasLoops = detectLoops(nodes.map(n => n.id), edges);
  
  // 检查连通性
  const connectivity = checkConnectivity(nodes.map(n => n.id), edges);
  
  return {
    nodes,
    edges,
    numberOfInterventions: nodes.length,
    numberOfComparisons: edges.length,
    numberOfStudies: studies.length,
    hasLoops,
    connectivity,
  };
}

/**
 * 检测网状中是否存在闭合环
 */
function detectLoops(nodeIds: string[], edges: NetworkEdge[]): boolean {
  // 使用DFS检测环
  const adjacency = new Map<string, string[]>();
  
  for (const id of nodeIds) {
    adjacency.set(id, []);
  }
  
  for (const edge of edges) {
    adjacency.get(edge.source)?.push(edge.target);
    adjacency.get(edge.target)?.push(edge.source);
  }
  
  const visited = new Set<string>();
  const recStack = new Set<string>();
  
  function dfs(node: string, parent: string | null): boolean {
    visited.add(node);
    recStack.add(node);
    
    const neighbors = adjacency.get(node) || [];
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        if (dfs(neighbor, node)) return true;
      } else if (neighbor !== parent && recStack.has(neighbor)) {
        return true;
      }
    }
    
    recStack.delete(node);
    return false;
  }
  
  for (const node of nodeIds) {
    if (!visited.has(node)) {
      if (dfs(node, null)) return true;
    }
  }
  
  return false;
}

/**
 * 检查网状连通性
 */
function checkConnectivity(nodeIds: string[], edges: NetworkEdge[]): 'connected' | 'disconnected' {
  if (nodeIds.length === 0) return 'connected';
  
  // 构建邻接表
  const adjacency = new Map<string, string[]>();
  for (const id of nodeIds) {
    adjacency.set(id, []);
  }
  
  for (const edge of edges) {
    adjacency.get(edge.source)?.push(edge.target);
    adjacency.get(edge.target)?.push(edge.source);
  }
  
  // BFS检查连通性
  const visited = new Set<string>();
  const queue = [nodeIds[0]];
  visited.add(nodeIds[0]);
  
  while (queue.length > 0) {
    const node = queue.shift()!;
    const neighbors = adjacency.get(node) || [];
    
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        queue.push(neighbor);
      }
    }
  }
  
  return visited.size === nodeIds.length ? 'connected' : 'disconnected';
}

// ==================== 间接比较计算 ====================

/**
 * Bucher方法：通过共同对照进行间接比较
 * 
 * 计算 B vs C 的间接效应量（通过共同对照A）
 * indirect(B vs C) = direct(B vs A) - direct(C vs A)
 */
export function calculateIndirectComparison(
  directBA: { effectSize: number; standardError: number },
  directCA: { effectSize: number; standardError: number }
): { effectSize: number; standardError: number } {
  const indirectEffect = directBA.effectSize - directCA.effectSize;
  const indirectSe = Math.sqrt(
    directBA.standardError * directBA.standardError +
    directCA.standardError * directCA.standardError
  );
  
  return {
    effectSize: indirectEffect,
    standardError: indirectSe,
  };
}

/**
 * 计算所有可能的网状比较
 */
export function calculateNetworkComparisons(
  directComparisons: Map<string, DirectComparison>,
  interventions: string[],
  config: AnalysisConfig
): NetworkComparison[] {
  const results: NetworkComparison[] = [];
  
  // 建立直接比较索引
  const directIndex = new Map<string, { effectSize: number; standardError: number }>();
  
  for (const [key, comp] of directComparisons) {
    directIndex.set(key, {
      effectSize: comp.effectSize,
      standardError: comp.standardError,
    });
  }
  
  // 计算所有干预对的比较
  for (let i = 0; i < interventions.length; i++) {
    for (let j = i + 1; j < interventions.length; j++) {
      const intA = interventions[i];
      const intB = interventions[j];
      
      const key = intA < intB ? `${intA}|${intB}` : `${intB}|${intA}`;
      
      // 检查是否有直接比较
      const directComp = directIndex.get(key);
      
      if (directComp) {
        // 有直接比较
        const z = directComp.effectSize / directComp.standardError;
        results.push({
          interventionA: intA,
          interventionB: intB,
          networkEffectSize: directComp.effectSize,
          networkStandardError: directComp.standardError,
          networkCiLower: directComp.effectSize - 1.96 * directComp.standardError,
          networkCiUpper: directComp.effectSize + 1.96 * directComp.standardError,
          pValue: zToPValue(z),
          comparisonType: 'direct',
          directEffectSize: directComp.effectSize,
          directStandardError: directComp.standardError,
        });
      } else {
        // 尝试间接比较
        const indirect = findIndirectPath(intA, intB, directIndex, interventions);
        
        if (indirect) {
          const z = indirect.effectSize / indirect.standardError;
          results.push({
            interventionA: intA,
            interventionB: intB,
            networkEffectSize: indirect.effectSize,
            networkStandardError: indirect.standardError,
            networkCiLower: indirect.effectSize - 1.96 * indirect.standardError,
            networkCiUpper: indirect.effectSize + 1.96 * indirect.standardError,
            pValue: zToPValue(z),
            comparisonType: 'indirect',
            indirectEffectSize: indirect.effectSize,
            indirectStandardError: indirect.standardError,
          });
        }
      }
    }
  }
  
  return results;
}

/**
 * 寻找间接比较路径
 */
function findIndirectPath(
  intA: string,
  intB: string,
  directIndex: Map<string, { effectSize: number; standardError: number }>,
  allInterventions: string[]
): { effectSize: number; standardError: number } | null {
  // 尝试通过每个可能的共同对照
  const indirectResults: Array<{ effectSize: number; standardError: number; weight: number }> = [];
  
  for (const common of allInterventions) {
    if (common === intA || common === intB) continue;
    
    const keyAC = intA < common ? `${intA}|${common}` : `${common}|${intA}`;
    const keyBC = intB < common ? `${intB}|${common}` : `${common}|${intB}`;
    
    const compAC = directIndex.get(keyAC);
    const compBC = directIndex.get(keyBC);
    
    if (compAC && compBC) {
      // 找到了共同对照
      // 需要确保方向正确
      let effectAC = compAC.effectSize;
      let effectBC = compBC.effectSize;
      
      // 如果共同对照在key中排前面，需要取负
      if (common < intA) effectAC = -effectAC;
      if (common < intB) effectBC = -effectBC;
      
      // A vs B = A vs C - B vs C
      const indirectEffect = effectAC - effectBC;
      const indirectSe = Math.sqrt(
        compAC.standardError * compAC.standardError +
        compBC.standardError * compBC.standardError
      );
      
      // 权重（用于后续可能的加权合并）
      const weight = 1 / (indirectSe * indirectSe);
      
      indirectResults.push({
        effectSize: indirectEffect,
        standardError: indirectSe,
        weight,
      });
    }
  }
  
  if (indirectResults.length === 0) {
    return null;
  }
  
  if (indirectResults.length === 1) {
    return {
      effectSize: indirectResults[0].effectSize,
      standardError: indirectResults[0].standardError,
    };
  }
  
  // 多条间接路径：加权合并
  const totalWeight = indirectResults.reduce((s, r) => s + r.weight, 0);
  const pooledEffect = indirectResults.reduce((s, r) => s + r.weight * r.effectSize, 0) / totalWeight;
  const pooledSe = Math.sqrt(1 / totalWeight);
  
  return {
    effectSize: pooledEffect,
    standardError: pooledSe,
  };
}

// ==================== SUCRA排名计算 ====================

/**
 * 计算SUCRA（Surface Under the Cumulative Ranking Curve）
 * 
 * SUCRA = (n - meanRank) / (n - 1)
 * 其中 n 是干预措施数量，meanRank 是平均排名
 */
export function calculateSUCRA(
  networkComparisons: NetworkComparison[],
  interventions: string[],
  referenceIntervention?: string
): TreatmentRanking[] {
  const n = interventions.length;
  
  if (n < 2) {
    return interventions.map((int, i) => ({
      intervention: int,
      sucra: 1,
      meanRank: 1,
      rankProbabilities: [1],
      numberOfStudies: 0,
    }));
  }
  
  // 构建效应量矩阵（相对于参照干预）
  const ref = referenceIntervention || interventions[0];
  const effectMatrix = new Map<string, { effectSize: number; standardError: number }>();
  
  // 参照干预的效应量为0
  effectMatrix.set(ref, { effectSize: 0, standardError: 0 });
  
  // 从网状比较中填充矩阵
  for (const comp of networkComparisons) {
    // 确保相对参照的方向正确
    if (comp.interventionA === ref) {
      effectMatrix.set(comp.interventionB, {
        effectSize: comp.networkEffectSize,
        standardError: comp.networkStandardError,
      });
    } else if (comp.interventionB === ref) {
      effectMatrix.set(comp.interventionA, {
        effectSize: -comp.networkEffectSize,
        standardError: comp.networkStandardError,
      });
    }
  }
  
  // 对于没有直接比较的干预，通过间接路径计算
  for (const int of interventions) {
    if (!effectMatrix.has(int)) {
      // 寻找间接路径
      const indirectEffect = calculateIndirectEffectRelativeToRef(
        int, ref, networkComparisons, interventions
      );
      if (indirectEffect) {
        effectMatrix.set(int, indirectEffect);
      } else {
        // 无法计算，使用默认值
        effectMatrix.set(int, { effectSize: 0, standardError: 999 });
      }
    }
  }
  
  // 计算每个干预的排名概率
  const rankings: TreatmentRanking[] = [];
  
  for (const int of interventions) {
    const effect = effectMatrix.get(int)!;
    
    // 计算该干预排名第一的概率
    // P(干预i排名第一) = P(effect_i > effect_j, 对所有j≠i)
    // 使用正态分布近似
    
    const rankProbabilities = calculateRankProbabilities(
      int, effect, effectMatrix, interventions
    );
    
    // 计算平均排名
    let meanRank = 0;
    for (let r = 0; r < n; r++) {
      meanRank += (r + 1) * rankProbabilities[r];
    }
    
    // SUCRA
    const sucra = (n - meanRank) / (n - 1);
    
    // 统计涉及的研究数（简化处理）
    const relevantComparisons = networkComparisons.filter(
      c => c.interventionA === int || c.interventionB === int
    );
    
    rankings.push({
      intervention: int,
      sucra: Math.max(0, Math.min(1, sucra)),
      meanRank,
      rankProbabilities,
      numberOfStudies: relevantComparisons.length,
    });
  }
  
  // 按SUCRA降序排序
  rankings.sort((a, b) => b.sucra - a.sucra);
  
  return rankings;
}

/**
 * 计算相对参照干预的间接效应量
 */
function calculateIndirectEffectRelativeToRef(
  intervention: string,
  reference: string,
  comparisons: NetworkComparison[],
  allInterventions: string[]
): { effectSize: number; standardError: number } | null {
  // 查找连接路径
  const visited = new Set<string>();
  const queue: Array<{ node: string; effectSize: number; variance: number }> = [
    { node: reference, effectSize: 0, variance: 0 }
  ];
  
  while (queue.length > 0) {
    const current = queue.shift()!;
    
    if (current.node === intervention) {
      return {
        effectSize: current.effectSize,
        standardError: Math.sqrt(current.variance),
      };
    }
    
    if (visited.has(current.node)) continue;
    visited.add(current.node);
    
    // 查找相邻干预
    for (const comp of comparisons) {
      let nextNode: string | null = null;
      let effectDelta = 0;
      let varianceDelta = 0;
      
      if (comp.interventionA === current.node && !visited.has(comp.interventionB)) {
        nextNode = comp.interventionB;
        effectDelta = comp.networkEffectSize;
        varianceDelta = comp.networkStandardError * comp.networkStandardError;
      } else if (comp.interventionB === current.node && !visited.has(comp.interventionA)) {
        nextNode = comp.interventionA;
        effectDelta = -comp.networkEffectSize;
        varianceDelta = comp.networkStandardError * comp.networkStandardError;
      }
      
      if (nextNode) {
        queue.push({
          node: nextNode,
          effectSize: current.effectSize + effectDelta,
          variance: current.variance + varianceDelta,
        });
      }
    }
  }
  
  return null;
}

/**
 * 计算排名概率（简化版本）
 */
function calculateRankProbabilities(
  intervention: string,
  effect: { effectSize: number; standardError: number },
  effectMatrix: Map<string, { effectSize: number; standardError: number }>,
  allInterventions: string[]
): number[] {
  const n = allInterventions.length;
  const probabilities = new Array(n).fill(0);
  
  // 使用蒙特卡洛模拟估计排名概率
  const simulations = 10000;
  const ranks = new Array(n).fill(0);
  
  for (let sim = 0; sim < simulations; sim++) {
    // 为每个干预生成随机效应量
    const sampledEffects = new Map<string, number>();
    
    for (const [int, data] of effectMatrix) {
      // 从正态分布采样
      const z = (Math.random() + Math.random() + Math.random() + Math.random() + Math.random() + Math.random() - 3) / Math.sqrt(0.5);
      sampledEffects.set(int, data.effectSize + z * data.standardError);
    }
    
    // 按效应量排序（假设效应量越大越好）
    const sorted = allInterventions.slice().sort((a, b) => {
      const effectA = sampledEffects.get(a) || 0;
      const effectB = sampledEffects.get(b) || 0;
      return effectB - effectA; // 降序
    });
    
    // 找到当前干预的排名
    const rank = sorted.indexOf(intervention);
    ranks[rank]++;
  }
  
  // 转换为概率
  for (let i = 0; i < n; i++) {
    probabilities[i] = ranks[i] / simulations;
  }
  
  return probabilities;
}

// ==================== 一致性检验 ====================

/**
 * Bucher一致性检验
 * 比较直接效应量和间接效应量
 */
export function bucherConsistencyTest(
  directEffect: { effectSize: number; standardError: number },
  indirectEffect: { effectSize: number; standardError: number }
): ConsistencyResult {
  const difference = directEffect.effectSize - indirectEffect.effectSize;
  const differenceSe = Math.sqrt(
    directEffect.standardError * directEffect.standardError +
    indirectEffect.standardError * indirectEffect.standardError
  );
  
  const z = difference / differenceSe;
  const pValue = zToPValue(z);
  
  // 通常以P<0.05认为存在不一致
  const isConsistent = pValue >= 0.05;
  
  let conclusion: string;
  if (isConsistent) {
    conclusion = `直接证据与间接证据一致 (P=${pValue.toFixed(3)})，可合并使用网状Meta分析结果。`;
  } else {
    conclusion = `直接证据与间接证据存在不一致 (P=${pValue.toFixed(3)})，应谨慎解读结果，考虑使用分离模型或调查不一致原因。`;
  }
  
  return {
    testMethod: 'bucher',
    directEffect: directEffect.effectSize,
    indirectEffect: indirectEffect.effectSize,
    difference,
    differenceSe,
    consistencyPValue: pValue,
    isConsistent,
    conclusion,
  };
}

/**
 * 执行所有可能的一致性检验
 */
export function performConsistencyTests(
  directComparisons: Map<string, DirectComparison>,
  networkComparisons: NetworkComparison[]
): ConsistencyResult[] {
  const results: ConsistencyResult[] = [];
  
  // 对于每个同时有直接和间接证据的比较进行检验
  for (const netComp of networkComparisons) {
    if (netComp.comparisonType !== 'network') continue;
    
    const key = netComp.interventionA < netComp.interventionB
      ? `${netComp.interventionA}|${netComp.interventionB}`
      : `${netComp.interventionB}|${netComp.interventionA}`;
    
    const directComp = directComparisons.get(key);
    
    if (directComp && netComp.indirectEffectSize !== undefined) {
      const test = bucherConsistencyTest(
        { effectSize: directComp.effectSize, standardError: directComp.standardError },
        { effectSize: netComp.indirectEffectSize, standardError: netComp.indirectStandardError! }
      );
      
      test.loop = [netComp.interventionA, netComp.interventionB];
      results.push(test);
    }
  }
  
  return results;
}

// ==================== 联盟表生成 ====================

/**
 * 生成联盟表（League Table）
 * 展示所有干预两两比较的结果
 */
export interface LeagueTableRow {
  intervention: string;
  comparisons: Array<{
    vs: string;
    effectSize: number;
    ciLower: number;
    ciUpper: number;
    pValue: number;
    isSignificant: boolean;
  }>;
}

export function generateLeagueTable(
  networkComparisons: NetworkComparison[],
  interventions: string[],
  effectMeasure: string
): LeagueTableRow[] {
  const table: LeagueTableRow[] = [];
  
  // 按SUCRA排序干预（假设已经计算好排名）
  for (const intA of interventions) {
    const row: LeagueTableRow = {
      intervention: intA,
      comparisons: [],
    };
    
    for (const intB of interventions) {
      if (intA === intB) {
        row.comparisons.push({
          vs: intB,
          effectSize: 0,
          ciLower: 0,
          ciUpper: 0,
          pValue: 1,
          isSignificant: false,
        });
        continue;
      }
      
      // 查找比较结果
      const comp = networkComparisons.find(
        c => (c.interventionA === intA && c.interventionB === intB) ||
             (c.interventionA === intB && c.interventionB === intA)
      );
      
      if (comp) {
        // 确保方向正确：intA vs intB
        const effect = comp.interventionA === intA ? comp.networkEffectSize : -comp.networkEffectSize;
        const ciLower = comp.interventionA === intA ? comp.networkCiLower : -comp.networkCiUpper;
        const ciUpper = comp.interventionA === intA ? comp.networkCiUpper : -comp.networkCiLower;
        
        row.comparisons.push({
          vs: intB,
          effectSize: effect,
          ciLower,
          ciUpper,
          pValue: comp.pValue,
          isSignificant: comp.pValue < 0.05,
        });
      } else {
        row.comparisons.push({
          vs: intB,
          effectSize: NaN,
          ciLower: NaN,
          ciUpper: NaN,
          pValue: NaN,
          isSignificant: false,
        });
      }
    }
    
    table.push(row);
  }
  
  return table;
}

// ==================== 导出格式化函数 ====================

/**
 * 格式化效应量显示
 */
export function formatEffectSize(
  effectSize: number,
  ciLower: number,
  ciUpper: number,
  measure: string
): string {
  // 对于OR/RR，需要取指数
  if (measure === 'OR' || measure === 'RR' || measure === 'HR') {
    const or = Math.exp(effectSize);
    const ciLo = Math.exp(ciLower);
    const ciHi = Math.exp(ciUpper);
    return `${or.toFixed(2)} [${ciLo.toFixed(2)}, ${ciHi.toFixed(2)}]`;
  }
  
  return `${effectSize.toFixed(3)} [${ciLower.toFixed(3)}, ${ciUpper.toFixed(3)}]`;
}

/**
 * 将对数效应量转换为原始尺度
 */
export function convertToOriginalScale(
  effectSize: number,
  ciLower: number,
  ciUpper: number,
  measure: string
): { effect: number; ciLower: number; ciUpper: number } {
  if (measure === 'OR' || measure === 'RR' || measure === 'HR') {
    return {
      effect: Math.exp(effectSize),
      ciLower: Math.exp(ciLower),
      ciUpper: Math.exp(ciUpper),
    };
  }
  
  return { effect: effectSize, ciLower, ciUpper };
}
