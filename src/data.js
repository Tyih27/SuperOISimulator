import { LEVEL_DEFINITIONS } from "./levels/index.js";

/**
 * Immutable battle data for the first single-player combat slice.
 *
 * The UI can consume this snapshot, while later combat modules can clone it
 * before applying runtime state changes. Permanent roster values live here;
 * current energy, focus, and topic progress belong to a battle snapshot.
 */

export const ENGINE_VERSION = "1";
export const RULESET_VERSION = "1";

export const ABILITY_KEYS = Object.freeze([
  "dynamicProgramming",
  "graphTheory",
  "dataStructures",
  "mathematics",
  "implementation"
]);

export const ABILITY_LABELS = Object.freeze({
  dynamicProgramming: "动态规划",
  graphTheory: "图论",
  dataStructures: "数据结构",
  mathematics: "数学",
  implementation: "代码实现"
});

export const NAME_POOL_VERSION = 1;

export const STUDENT_NAME_POOLS = Object.freeze({
  [NAME_POOL_VERSION]: Object.freeze({
    surnames: Object.freeze(["林", "周", "苏", "顾", "陈", "许", "沈", "陆", "程", "唐", "叶", "方"]),
    givenNames: Object.freeze(["澈", "岚", "砚", "言", "默", "宁", "遥", "川", "禾", "知", "予", "衡", "然", "清", "朗", "思"]),
  }),
});

// Adjacent aptitude bands never overlap: every higher tier's minimum equals
// or exceeds the previous tier's maximum for each ability, so a higher
// aptitude always dominates every lower one before any training.
export const APTITUDE_ABILITY_RANGES = Object.freeze({
  "普通": Object.freeze({
    dynamicProgramming: Object.freeze([450, 650]), graphTheory: Object.freeze([450, 650]), dataStructures: Object.freeze([500, 700]), mathematics: Object.freeze([350, 550]), implementation: Object.freeze([800, 1000]),
  }),
  "优秀": Object.freeze({
    dynamicProgramming: Object.freeze([650, 800]), graphTheory: Object.freeze([650, 800]), dataStructures: Object.freeze([700, 850]), mathematics: Object.freeze([550, 700]), implementation: Object.freeze([1000, 1150]),
  }),
  "稀有": Object.freeze({
    dynamicProgramming: Object.freeze([800, 950]), graphTheory: Object.freeze([800, 950]), dataStructures: Object.freeze([850, 1000]), mathematics: Object.freeze([700, 850]), implementation: Object.freeze([1150, 1300]),
  }),
  "天才": Object.freeze({
    dynamicProgramming: Object.freeze([950, 1100]), graphTheory: Object.freeze([950, 1100]), dataStructures: Object.freeze([1000, 1150]), mathematics: Object.freeze([850, 1000]), implementation: Object.freeze([1300, 1450]),
  }),
  "顶尖": Object.freeze({
    dynamicProgramming: Object.freeze([1100, 1300]), graphTheory: Object.freeze([1100, 1300]), dataStructures: Object.freeze([1150, 1350]), mathematics: Object.freeze([1000, 1200]), implementation: Object.freeze([1450, 1650]),
  }),
});

export const APTITUDE_ORDER = Object.freeze(["普通", "优秀", "稀有", "天才", "顶尖"]);

// Recruitment weights are intentionally data-driven so balancing does not
// require changing the recruitment transaction or student generation code.
export const RECRUITMENT_APTITUDE_WEIGHTS = Object.freeze({
  "普通": 0.70,
  "优秀": 0.20,
  "稀有": 0.08,
  "天才": 0.019,
  "顶尖": 0.001,
});

export const RECRUITMENT_PITY_LIMIT = 30;

const freeze = (value) => {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
};

const problemSkill = (skill) => ({
  category: "problem",
  focusGain: 200,
  skillMultiplier: 1,
  targetMultiplier: 1,
  flatBonus: 0,
  ...skill
});

const supportSkill = (skill) => ({
  category: "support",
  focusGain: 200,
  relatedAbility: "overall",
  effect: { base: 0, multiplier: 0 },
  ...skill
});

const topicSkill = (skill) => ({
  category: "problem",
  effectType: "energyDamage",
  targetRule: "matchingPosition",
  damageMultiplier: 1,
  flatBonus: 0,
  ...skill
});

/**
 * Skill content is a catalogue, separate from a student's identity and
 * progression. A student selects one group through `skillGroupId`.
 */
export const SKILL_GROUPS = freeze({
  planner: {
    id: "planner",
    name: "拆解思路",
    skills: {
      normal: problemSkill({ id: "planner-normal", name: "逐个击破", targetRule: "lowestRemaining", relatedAbility: "dynamicProgramming" }),
      burst: problemSkill({ id: "planner-burst", name: "关键路径", targetRule: "highestDifficulty", relatedAbility: "dynamicProgramming", skillMultiplier: 1.5 })
    }
  },
  graphist: {
    id: "graphist",
    name: "图论直觉",
    skills: {
      normal: problemSkill({ id: "graphist-normal", name: "匹配攻击", targetRule: "bestMatch", relatedAbility: "graphTheory" }),
      burst: problemSkill({ id: "graphist-burst", name: "割点突破", targetRule: "highestDifficulty", relatedAbility: "graphTheory", skillMultiplier: 1.35, flatBonus: 120 })
    }
  },
  structurer: {
    id: "structurer",
    name: "结构维护",
    skills: {
      normal: supportSkill({ id: "structurer-normal", name: "稳态修复", targetRule: "lowestEnergy", effectType: "energyRestore", effect: { base: 650, multiplier: 0.25 } }),
      burst: supportSkill({ id: "structurer-burst", name: "全队整备", targetRule: "allStudents", effectType: "energyRestore", effect: { base: 420, multiplier: 0.12 } })
    }
  },
  mathematician: {
    id: "mathematician",
    name: "严密推导",
    skills: {
      normal: problemSkill({ id: "mathematician-normal", name: "精确推导", targetRule: "bestMatch", relatedAbility: "mathematics", skillMultiplier: 1.1 }),
      burst: problemSkill({ id: "mathematician-burst", name: "极限证明", targetRule: "highestDifficulty", relatedAbility: "mathematics", skillMultiplier: 1.6 })
    }
  },
  implementer: {
    id: "implementer",
    name: "工程执行",
    skills: {
      normal: problemSkill({ id: "implementer-normal", name: "稳定输出", targetRule: "alignedFirst", relatedAbility: "implementation" }),
      burst: problemSkill({ id: "implementer-burst", name: "连续提交", targetRule: "lowestRemaining", relatedAbility: "implementation", skillMultiplier: 1.25, targetMultiplier: 0.8, flatBonus: 240 })
    }
  },
  supporter: {
    id: "supporter",
    name: "团队协作",
    skills: {
      normal: supportSkill({ id: "supporter-normal", name: "专注鼓舞", targetRule: "lowestFocus", effectType: "focusGain", effect: { base: 120, multiplier: 0.1 } }),
      burst: supportSkill({ id: "supporter-burst", name: "集体增益", targetRule: "allStudents", effectType: "focusGain", effect: { base: 180, multiplier: 0.16 } })
    }
  }
});

export const STUDENTS = freeze([
  {
    id: "planner",
    defaultAptitude: "普通",
    abilities: { dynamicProgramming: 620, graphTheory: 540, dataStructures: 610, mathematics: 420, implementation: 880 },
    maxEnergy: 5200,
    skillGroupId: "planner",
    skillGroupLevels: { planner: { normal: 1, burst: 1 } }
  },
  {
    id: "graphist",
    defaultAptitude: "普通",
    abilities: { dynamicProgramming: 520, graphTheory: 630, dataStructures: 640, mathematics: 500, implementation: 840 },
    maxEnergy: 5000,
    skillGroupId: "graphist",
    skillGroupLevels: { graphist: { normal: 1, burst: 1 } }
  },
  {
    id: "structurer",
    defaultAptitude: "普通",
    abilities: { dynamicProgramming: 580, graphTheory: 560, dataStructures: 680, mathematics: 460, implementation: 860 },
    maxEnergy: 5600,
    skillGroupId: "structurer",
    skillGroupLevels: { structurer: { normal: 1, burst: 1 } }
  },
  {
    id: "mathematician",
    defaultAptitude: "普通",
    abilities: { dynamicProgramming: 540, graphTheory: 500, dataStructures: 560, mathematics: 530, implementation: 820 },
    maxEnergy: 4700,
    skillGroupId: "mathematician",
    skillGroupLevels: { mathematician: { normal: 1, burst: 1 } }
  },
  {
    id: "implementer",
    defaultAptitude: "普通",
    abilities: { dynamicProgramming: 500, graphTheory: 540, dataStructures: 600, mathematics: 420, implementation: 950 },
    maxEnergy: 5100,
    skillGroupId: "implementer",
    skillGroupLevels: { implementer: { normal: 1, burst: 1 } }
  },
  {
    id: "supporter",
    defaultAptitude: "普通",
    abilities: { dynamicProgramming: 560, graphTheory: 570, dataStructures: 610, mathematics: 480, implementation: 850 },
    maxEnergy: 5400,
    skillGroupId: "supporter",
    skillGroupLevels: { supporter: { normal: 1, burst: 1 } }
  }
]);

export const TOPICS = freeze([
  { id: "treeKnapsack", name: "树上背包", difficulties: { dynamicProgramming: 800, graphTheory: 0, dataStructures: 300, mathematics: 0, implementation: 600 }, maxProgress: 10000, skill: topicSkill({ id: "treeKnapsack-attack", name: "递归压力" }) },
  { id: "maxFlow", name: "网络流", difficulties: { dynamicProgramming: 0, graphTheory: 920, dataStructures: 420, mathematics: 0, implementation: 600 }, maxProgress: 10000, skill: topicSkill({ id: "maxFlow-attack", name: "残量冲击" }) },
  { id: "persistentSegmentTree", name: "可持久化线段树", difficulties: { dynamicProgramming: 0, graphTheory: 0, dataStructures: 880, mathematics: 0, implementation: 720 }, maxProgress: 10000, skill: topicSkill({ id: "persistentSegmentTree-attack", name: "历史负荷" }) },
  { id: "combinatorics", name: "组合计数", difficulties: { dynamicProgramming: 420, graphTheory: 0, dataStructures: 0, mathematics: 860, implementation: 520 }, maxProgress: 10000, skill: topicSkill({ id: "combinatorics-attack", name: "组合爆炸" }) },
  { id: "computationalGeometry", name: "计算几何", difficulties: { dynamicProgramming: 0, graphTheory: 360, dataStructures: 0, mathematics: 900, implementation: 680 }, maxProgress: 10000, skill: topicSkill({ id: "computationalGeometry-attack", name: "精度扰动" }) },
  { id: "compilerOptimization", name: "编译优化", difficulties: { dynamicProgramming: 640, graphTheory: 0, dataStructures: 520, mathematics: 0, implementation: 940 }, maxProgress: 10000, skill: topicSkill({ id: "compilerOptimization-attack", name: "编译阻塞" }) },
  { id: "dynamicConnectivity", name: "动态连通性", difficulties: { dynamicProgramming: 0, graphTheory: 780, dataStructures: 840, mathematics: 0, implementation: 620 }, maxProgress: 10000, skill: topicSkill({ id: "dynamicConnectivity-attack", name: "连通震荡" }) },
  { id: "matrixPower", name: "矩阵快速幂", difficulties: { dynamicProgramming: 500, graphTheory: 0, dataStructures: 0, mathematics: 820, implementation: 560 }, maxProgress: 10000, skill: topicSkill({ id: "matrixPower-attack", name: "维度压制" }) },
  // Chapter 2 hard tiers. Each tier scales the base subjects' ability spread
  // so a level's recommended total power (3 students x average ability)
  // genuinely reflects the training needed to clear it.
  // Tier 1 (加练): relevant abilities ~1200-1880 -> team power ~5000.
  { id: "drill-treeKnapsack", name: "加练·树上背包", difficulties: { dynamicProgramming: 1600, graphTheory: 0, dataStructures: 600, mathematics: 0, implementation: 1200 }, maxProgress: 10000, skill: topicSkill({ id: "drill-treeKnapsack-attack", name: "递归重压" }) },
  { id: "drill-maxFlow", name: "加练·网络流", difficulties: { dynamicProgramming: 0, graphTheory: 1840, dataStructures: 840, mathematics: 0, implementation: 1200 }, maxProgress: 10000, skill: topicSkill({ id: "drill-maxFlow-attack", name: "残量洪流" }) },
  { id: "drill-persistentSegmentTree", name: "加练·可持久化线段树", difficulties: { dynamicProgramming: 0, graphTheory: 0, dataStructures: 1760, mathematics: 0, implementation: 1440 }, maxProgress: 10000, skill: topicSkill({ id: "drill-persistentSegmentTree-attack", name: "历史回溯" }) },
  { id: "drill-combinatorics", name: "加练·组合计数", difficulties: { dynamicProgramming: 840, graphTheory: 0, dataStructures: 0, mathematics: 1720, implementation: 1040 }, maxProgress: 10000, skill: topicSkill({ id: "drill-combinatorics-attack", name: "组合坍缩" }) },
  { id: "drill-computationalGeometry", name: "加练·计算几何", difficulties: { dynamicProgramming: 0, graphTheory: 720, dataStructures: 0, mathematics: 1800, implementation: 1360 }, maxProgress: 10000, skill: topicSkill({ id: "drill-computationalGeometry-attack", name: "精度崩坏" }) },
  { id: "drill-compilerOptimization", name: "加练·编译优化", difficulties: { dynamicProgramming: 1280, graphTheory: 0, dataStructures: 1040, mathematics: 0, implementation: 1880 }, maxProgress: 10000, skill: topicSkill({ id: "drill-compilerOptimization-attack", name: "指令阻塞" }) },
  { id: "drill-dynamicConnectivity", name: "加练·动态连通性", difficulties: { dynamicProgramming: 0, graphTheory: 1560, dataStructures: 1680, mathematics: 0, implementation: 1240 }, maxProgress: 10000, skill: topicSkill({ id: "drill-dynamicConnectivity-attack", name: "连通风暴" }) },
  { id: "drill-matrixPower", name: "加练·矩阵快速幂", difficulties: { dynamicProgramming: 1000, graphTheory: 0, dataStructures: 0, mathematics: 1640, implementation: 1120 }, maxProgress: 10000, skill: topicSkill({ id: "drill-matrixPower-attack", name: "维度碾压" }) },
  // Tier 2 (集训): relevant abilities ~1680-3760 -> team power ~10000.
  { id: "camp-treeKnapsack", name: "集训·树上背包", difficulties: { dynamicProgramming: 3200, graphTheory: 0, dataStructures: 1200, mathematics: 0, implementation: 2400 }, maxProgress: 10000, skill: topicSkill({ id: "camp-treeKnapsack-attack", name: "递归深渊" }) },
  { id: "camp-maxFlow", name: "集训·网络流", difficulties: { dynamicProgramming: 0, graphTheory: 3680, dataStructures: 1680, mathematics: 0, implementation: 2400 }, maxProgress: 10000, skill: topicSkill({ id: "camp-maxFlow-attack", name: "残量海啸" }) },
  { id: "camp-persistentSegmentTree", name: "集训·可持久化线段树", difficulties: { dynamicProgramming: 0, graphTheory: 0, dataStructures: 3520, mathematics: 0, implementation: 2880 }, maxProgress: 10000, skill: topicSkill({ id: "camp-persistentSegmentTree-attack", name: "时空负荷" }) },
  { id: "camp-combinatorics", name: "集训·组合计数", difficulties: { dynamicProgramming: 1680, graphTheory: 0, dataStructures: 0, mathematics: 3440, implementation: 2080 }, maxProgress: 10000, skill: topicSkill({ id: "camp-combinatorics-attack", name: "排列湮灭" }) },
  { id: "camp-computationalGeometry", name: "集训·计算几何", difficulties: { dynamicProgramming: 0, graphTheory: 1440, dataStructures: 0, mathematics: 3600, implementation: 2720 }, maxProgress: 10000, skill: topicSkill({ id: "camp-computationalGeometry-attack", name: "维度畸变" }) },
  { id: "camp-compilerOptimization", name: "集训·编译优化", difficulties: { dynamicProgramming: 2560, graphTheory: 0, dataStructures: 2080, mathematics: 0, implementation: 3760 }, maxProgress: 10000, skill: topicSkill({ id: "camp-compilerOptimization-attack", name: "流水线停摆" }) },
  { id: "camp-dynamicConnectivity", name: "集训·动态连通性", difficulties: { dynamicProgramming: 0, graphTheory: 3120, dataStructures: 3360, mathematics: 0, implementation: 2480 }, maxProgress: 10000, skill: topicSkill({ id: "camp-dynamicConnectivity-attack", name: "图裂震荡" }) },
  { id: "camp-matrixPower", name: "集训·矩阵快速幂", difficulties: { dynamicProgramming: 2000, graphTheory: 0, dataStructures: 0, mathematics: 3280, implementation: 2240 }, maxProgress: 10000, skill: topicSkill({ id: "camp-matrixPower-attack", name: "幂次坍塌" }) },
  // Tier 3 (大考): relevant abilities ~2880-7520 -> team power ~20000.
  { id: "exam-treeKnapsack", name: "大考·树上背包", difficulties: { dynamicProgramming: 6400, graphTheory: 0, dataStructures: 2400, mathematics: 0, implementation: 4800 }, maxProgress: 10000, skill: topicSkill({ id: "exam-treeKnapsack-attack", name: "递归奇点" }) },
  { id: "exam-maxFlow", name: "大考·网络流", difficulties: { dynamicProgramming: 0, graphTheory: 7360, dataStructures: 3360, mathematics: 0, implementation: 4800 }, maxProgress: 10000, skill: topicSkill({ id: "exam-maxFlow-attack", name: "残量决堤" }) },
  { id: "exam-persistentSegmentTree", name: "大考·可持久化线段树", difficulties: { dynamicProgramming: 0, graphTheory: 0, dataStructures: 7040, mathematics: 0, implementation: 5760 }, maxProgress: 10000, skill: topicSkill({ id: "exam-persistentSegmentTree-attack", name: "历史过载" }) },
  { id: "exam-combinatorics", name: "大考·组合计数", difficulties: { dynamicProgramming: 3360, graphTheory: 0, dataStructures: 0, mathematics: 6880, implementation: 4160 }, maxProgress: 10000, skill: topicSkill({ id: "exam-combinatorics-attack", name: "组合黑洞" }) },
  { id: "exam-computationalGeometry", name: "大考·计算几何", difficulties: { dynamicProgramming: 0, graphTheory: 2880, dataStructures: 0, mathematics: 7200, implementation: 5440 }, maxProgress: 10000, skill: topicSkill({ id: "exam-computationalGeometry-attack", name: "精度湮灭" }) },
  { id: "exam-compilerOptimization", name: "大考·编译优化", difficulties: { dynamicProgramming: 5120, graphTheory: 0, dataStructures: 4160, mathematics: 0, implementation: 7520 }, maxProgress: 10000, skill: topicSkill({ id: "exam-compilerOptimization-attack", name: "编译死锁" }) },
  { id: "exam-dynamicConnectivity", name: "大考·动态连通性", difficulties: { dynamicProgramming: 0, graphTheory: 6240, dataStructures: 6720, mathematics: 0, implementation: 4960 }, maxProgress: 10000, skill: topicSkill({ id: "exam-dynamicConnectivity-attack", name: "连通崩溃" }) },
  { id: "exam-matrixPower", name: "大考·矩阵快速幂", difficulties: { dynamicProgramming: 4000, graphTheory: 0, dataStructures: 0, mathematics: 6560, implementation: 4480 }, maxProgress: 10000, skill: topicSkill({ id: "exam-matrixPower-attack", name: "维度绞杀" }) },
  // Tier 4 (国赛): relevant abilities ~4320-11280 -> team power ~30000.
  { id: "national-treeKnapsack", name: "国赛·树上背包", difficulties: { dynamicProgramming: 9600, graphTheory: 0, dataStructures: 3600, mathematics: 0, implementation: 7200 }, maxProgress: 10000, skill: topicSkill({ id: "national-treeKnapsack-attack", name: "递归终局" }) },
  { id: "national-maxFlow", name: "国赛·网络流", difficulties: { dynamicProgramming: 0, graphTheory: 11040, dataStructures: 5040, mathematics: 0, implementation: 7200 }, maxProgress: 10000, skill: topicSkill({ id: "national-maxFlow-attack", name: "残量天灾" }) },
  { id: "national-persistentSegmentTree", name: "国赛·可持久化线段树", difficulties: { dynamicProgramming: 0, graphTheory: 0, dataStructures: 10560, mathematics: 0, implementation: 8640 }, maxProgress: 10000, skill: topicSkill({ id: "national-persistentSegmentTree-attack", name: "历史审判" }) },
  { id: "national-combinatorics", name: "国赛·组合计数", difficulties: { dynamicProgramming: 5040, graphTheory: 0, dataStructures: 0, mathematics: 10320, implementation: 6240 }, maxProgress: 10000, skill: topicSkill({ id: "national-combinatorics-attack", name: "组合末日" }) },
  { id: "national-computationalGeometry", name: "国赛·计算几何", difficulties: { dynamicProgramming: 0, graphTheory: 4320, dataStructures: 0, mathematics: 10800, implementation: 8160 }, maxProgress: 10000, skill: topicSkill({ id: "national-computationalGeometry-attack", name: "精度悖论" }) },
  { id: "national-compilerOptimization", name: "国赛·编译优化", difficulties: { dynamicProgramming: 7680, graphTheory: 0, dataStructures: 6240, mathematics: 0, implementation: 11280 }, maxProgress: 10000, skill: topicSkill({ id: "national-compilerOptimization-attack", name: "编译天堑" }) },
  { id: "national-dynamicConnectivity", name: "国赛·动态连通性", difficulties: { dynamicProgramming: 0, graphTheory: 9360, dataStructures: 10080, mathematics: 0, implementation: 7440 }, maxProgress: 10000, skill: topicSkill({ id: "national-dynamicConnectivity-attack", name: "连通寂灭" }) },
  { id: "national-matrixPower", name: "国赛·矩阵快速幂", difficulties: { dynamicProgramming: 6000, graphTheory: 0, dataStructures: 0, mathematics: 9840, implementation: 6720 }, maxProgress: 10000, skill: topicSkill({ id: "national-matrixPower-attack", name: "维度封印" }) }
]);

export const LEVELS = freeze(LEVEL_DEFINITIONS);

export const BALANCE_BASELINE_TOLERANCE = 0.10;

export const BALANCE_BASELINES = freeze({
  "chapter-1-1": { seeds: [1, 2, 3, 4, 5], winRate: 0.3433333333333333 },
  "chapter-1-2": { seeds: [1, 2, 3, 4, 5], winRate: 0.011666666666666667 },
  "chapter-1-3": { seeds: [1, 2, 3, 4, 5], winRate: 0 },
  "chapter-1-4": { seeds: [1, 2, 3, 4, 5], winRate: 0 },
  "chapter-2-1": { seeds: [1, 2, 3, 4, 5], winRate: 0 },
  "chapter-2-2": { seeds: [1, 2, 3, 4, 5], winRate: 0 },
  "chapter-2-3": { seeds: [1, 2, 3, 4, 5], winRate: 0 },
  "chapter-2-4": { seeds: [1, 2, 3, 4, 5], winRate: 0 },
});

export const SHOP_OFFERS = freeze([
  { id: "recruitment-right", name: "招募权", price: { trainingCoins: 300 }, grants: { recruitmentTickets: 1 } },
  { id: "daily-dp-book", name: "动态规划专项训练册", price: { trainingCoins: 120 }, grants: { "specialist-book-dynamicProgramming": 1 } },
  { id: "daily-graph-book", name: "图论专项训练册", price: { trainingCoins: 120 }, grants: { "specialist-book-graphTheory": 1 } },
  { id: "data-book", name: "数据结构专项训练册", price: { trainingCoins: 100 }, grants: { "specialist-book-dataStructures": 1 } },
  { id: "math-book", name: "数学专项训练册", price: { trainingCoins: 100 }, grants: { "specialist-book-mathematics": 1 } },
  { id: "implementation-book", name: "代码实现专项训练册", price: { trainingCoins: 100 }, grants: { "specialist-book-implementation": 1 } },
]);

export const DEFAULT_FORMATION = freeze({ A1: "planner", A2: "graphist", A3: "structurer" });

export function createInitialBattleConfig({ levelId = LEVELS[0].id, seed } = {}) {
  const level = LEVELS.find((item) => item.id === levelId);
  if (!level) throw new Error(`Unknown level: ${levelId}`);

  return {
    level: { ...level, seed: seed ?? level.seed },
    skillGroups: structuredClone(SKILL_GROUPS),
    roster: STUDENTS.map((student) => ({
      ...student,
      abilities: { ...student.abilities },
      skillGroupLevels: structuredClone(student.skillGroupLevels),
      currentEnergy: student.maxEnergy,
      focus: 0
    })),
    formation: { ...DEFAULT_FORMATION },
    topics: TOPICS.filter((topic) => level.topicIds.includes(topic.id)).map((topic) => ({
      ...topic,
      difficulties: { ...topic.difficulties },
      skill: { ...topic.skill },
      progress: 0,
      currentDifficulties: { ...topic.difficulties }
    }))
  };
}
