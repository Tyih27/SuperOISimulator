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

export const APTITUDE_ABILITY_RANGES = Object.freeze({
  "普通": Object.freeze({
    dynamicProgramming: Object.freeze([450, 650]), graphTheory: Object.freeze([450, 650]), dataStructures: Object.freeze([500, 700]), mathematics: Object.freeze([350, 550]), implementation: Object.freeze([800, 1000]),
  }),
  "优秀": Object.freeze({
    dynamicProgramming: Object.freeze([450, 900]), graphTheory: Object.freeze([450, 900]), dataStructures: Object.freeze([450, 900]), mathematics: Object.freeze([400, 900]), implementation: Object.freeze([600, 900]),
  }),
  "稀有": Object.freeze({
    dynamicProgramming: Object.freeze([500, 950]), graphTheory: Object.freeze([500, 950]), dataStructures: Object.freeze([500, 950]), mathematics: Object.freeze([450, 950]), implementation: Object.freeze([550, 950]),
  }),
  "天才": Object.freeze({
    dynamicProgramming: Object.freeze([500, 1000]), graphTheory: Object.freeze([500, 1000]), dataStructures: Object.freeze([500, 1000]), mathematics: Object.freeze([500, 1000]), implementation: Object.freeze([500, 1000]),
  }),
  "顶尖": Object.freeze({
    dynamicProgramming: Object.freeze([800, 1000]), graphTheory: Object.freeze([800, 1000]), dataStructures: Object.freeze([800, 1000]), mathematics: Object.freeze([800, 1000]), implementation: Object.freeze([800, 1000]),
  }),
});

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
  effect: { base: 0, multiplier: 0, min: 0, max: 2000 },
  ...skill
});

const topicSkill = (skill) => ({
  category: "problem",
  effectType: "energyDamage",
  targetRule: "matchingPosition",
  damageMultiplier: 1,
  flatBonus: 0,
  maxDamage: 2000,
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
      normal: supportSkill({ id: "structurer-normal", name: "稳态修复", targetRule: "lowestEnergy", effectType: "energyRestore", effect: { base: 650, multiplier: 0.25, min: 300, max: 1800 } }),
      burst: supportSkill({ id: "structurer-burst", name: "全队整备", targetRule: "allStudents", effectType: "energyRestore", effect: { base: 420, multiplier: 0.12, min: 180, max: 1000 } })
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
      normal: supportSkill({ id: "supporter-normal", name: "专注鼓舞", targetRule: "lowestFocus", effectType: "focusGain", effect: { base: 120, multiplier: 0.1, min: 80, max: 300 } }),
      burst: supportSkill({ id: "supporter-burst", name: "集体增益", targetRule: "allStudents", effectType: "focusGain", effect: { base: 180, multiplier: 0.16, min: 120, max: 500 } })
    }
  }
});

export const STUDENTS = freeze([
  {
    id: "planner",
    defaultAptitude: "普通",
    abilities: { dynamicProgramming: 820, graphTheory: 540, dataStructures: 610, mathematics: 420, implementation: 760 },
    maxEnergy: 5200,
    skillGroupId: "planner",
    skillGroupLevels: { planner: { normal: 1, burst: 1 } }
  },
  {
    id: "graphist",
    defaultAptitude: "普通",
    abilities: { dynamicProgramming: 520, graphTheory: 860, dataStructures: 640, mathematics: 580, implementation: 700 },
    maxEnergy: 5000,
    skillGroupId: "graphist",
    skillGroupLevels: { graphist: { normal: 1, burst: 1 } }
  },
  {
    id: "structurer",
    defaultAptitude: "普通",
    abilities: { dynamicProgramming: 580, graphTheory: 610, dataStructures: 900, mathematics: 500, implementation: 650 },
    maxEnergy: 5600,
    skillGroupId: "structurer",
    skillGroupLevels: { structurer: { normal: 1, burst: 1 } }
  },
  {
    id: "mathematician",
    defaultAptitude: "普通",
    abilities: { dynamicProgramming: 600, graphTheory: 570, dataStructures: 560, mathematics: 920, implementation: 620 },
    maxEnergy: 4700,
    skillGroupId: "mathematician",
    skillGroupLevels: { mathematician: { normal: 1, burst: 1 } }
  },
  {
    id: "implementer",
    defaultAptitude: "普通",
    abilities: { dynamicProgramming: 570, graphTheory: 600, dataStructures: 620, mathematics: 480, implementation: 900 },
    maxEnergy: 5100,
    skillGroupId: "implementer",
    skillGroupLevels: { implementer: { normal: 1, burst: 1 } }
  },
  {
    id: "supporter",
    defaultAptitude: "普通",
    abilities: { dynamicProgramming: 640, graphTheory: 650, dataStructures: 620, mathematics: 610, implementation: 680 },
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
  { id: "matrixPower", name: "矩阵快速幂", difficulties: { dynamicProgramming: 500, graphTheory: 0, dataStructures: 0, mathematics: 820, implementation: 560 }, maxProgress: 10000, skill: topicSkill({ id: "matrixPower-attack", name: "维度压制" }) }
]);

export const LEVELS = freeze(LEVEL_DEFINITIONS);

export const BALANCE_BASELINE_TOLERANCE = 0.10;

export const BALANCE_BASELINES = freeze({
  "chapter-1-1": { seeds: [1, 2, 3, 4, 5], winRate: 0 },
  "chapter-1-2": { seeds: [1, 2, 3, 4, 5], winRate: 0.058333333333333334 },
  "chapter-1-3": { seeds: [1, 2, 3, 4, 5], winRate: 0 },
  "chapter-1-4": { seeds: [1, 2, 3, 4, 5], winRate: 0 },
});

export const SHOP_OFFERS = freeze([
  { id: "daily-dp-book", name: "动态规划专项训练册", price: { trainingCoins: 120 }, grants: { "specialist-book-dynamicProgramming": 1 }, purchaseLimit: { period: "daily", count: 1 } },
  { id: "daily-graph-book", name: "图论专项训练册", price: { trainingCoins: 120 }, grants: { "specialist-book-graphTheory": 1 }, purchaseLimit: { period: "daily", count: 1 } },
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
