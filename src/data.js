/**
 * Immutable battle data for the first single-player combat slice.
 *
 * The UI can consume this snapshot, while later combat modules can clone it
 * before applying runtime state changes. Permanent roster values live here;
 * current energy, focus, and topic progress belong to a battle snapshot.
 */

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

export const STUDENTS = freeze([
  {
    id: "planner",
    name: "规划手",
    aptitude: "优秀",
    role: "单体解题",
    abilities: { dynamicProgramming: 820, graphTheory: 540, dataStructures: 610, mathematics: 420, implementation: 760 },
    maxEnergy: 5200,
    skills: {
      normal: problemSkill({ id: "planner-normal", name: "逐个击破", targetRule: "lowestRemaining", relatedAbility: "dynamicProgramming" }),
      burst: problemSkill({ id: "planner-burst", name: "关键路径", targetRule: "highestDifficulty", relatedAbility: "dynamicProgramming", skillMultiplier: 1.5 })
    }
  },
  {
    id: "graphist",
    name: "图论手",
    aptitude: "优秀",
    role: "单体解题",
    abilities: { dynamicProgramming: 520, graphTheory: 860, dataStructures: 640, mathematics: 580, implementation: 700 },
    maxEnergy: 5000,
    skills: {
      normal: problemSkill({ id: "graphist-normal", name: "匹配攻击", targetRule: "bestMatch", relatedAbility: "graphTheory" }),
      burst: problemSkill({ id: "graphist-burst", name: "割点突破", targetRule: "highestDifficulty", relatedAbility: "graphTheory", skillMultiplier: 1.35, flatBonus: 120 })
    }
  },
  {
    id: "structurer",
    name: "结构手",
    aptitude: "稀有",
    role: "防守辅助",
    abilities: { dynamicProgramming: 580, graphTheory: 610, dataStructures: 900, mathematics: 500, implementation: 650 },
    maxEnergy: 5600,
    skills: {
      normal: supportSkill({ id: "structurer-normal", name: "稳态修复", targetRule: "lowestEnergy", effect: { base: 650, multiplier: 0.25, min: 300, max: 1800 } }),
      burst: supportSkill({ id: "structurer-burst", name: "全队整备", targetRule: "allStudents", effect: { base: 420, multiplier: 0.12, min: 180, max: 1000 } })
    }
  },
  {
    id: "mathematician",
    name: "数学手",
    aptitude: "天才",
    role: "难题解答",
    abilities: { dynamicProgramming: 600, graphTheory: 570, dataStructures: 560, mathematics: 920, implementation: 620 },
    maxEnergy: 4700,
    skills: {
      normal: problemSkill({ id: "mathematician-normal", name: "精确推导", targetRule: "bestMatch", relatedAbility: "mathematics", skillMultiplier: 1.1 }),
      burst: problemSkill({ id: "mathematician-burst", name: "极限证明", targetRule: "highestDifficulty", relatedAbility: "mathematics", skillMultiplier: 1.6 })
    }
  },
  {
    id: "implementer",
    name: "实现手",
    aptitude: "普通",
    role: "稳定输出",
    abilities: { dynamicProgramming: 570, graphTheory: 600, dataStructures: 620, mathematics: 480, implementation: 900 },
    maxEnergy: 5100,
    skills: {
      normal: problemSkill({ id: "implementer-normal", name: "稳定输出", targetRule: "alignedFirst", relatedAbility: "implementation" }),
      burst: problemSkill({ id: "implementer-burst", name: "连续提交", targetRule: "lowestRemaining", relatedAbility: "implementation", skillMultiplier: 1.25, targetMultiplier: 0.8, flatBonus: 240 })
    }
  },
  {
    id: "supporter",
    name: "支援手",
    aptitude: "稀有",
    role: "增益辅助",
    abilities: { dynamicProgramming: 640, graphTheory: 650, dataStructures: 620, mathematics: 610, implementation: 680 },
    maxEnergy: 5400,
    skills: {
      normal: supportSkill({ id: "supporter-normal", name: "专注鼓舞", targetRule: "lowestFocus", effect: { base: 120, multiplier: 0.1, min: 80, max: 300 } }),
      burst: supportSkill({ id: "supporter-burst", name: "集体增益", targetRule: "allStudents", effect: { base: 180, multiplier: 0.16, min: 120, max: 500 } })
    }
  }
]);

export const TOPICS = freeze([
  { id: "treeKnapsack", name: "树上背包", difficulties: { dynamicProgramming: 800, graphTheory: 0, dataStructures: 300, mathematics: 0, implementation: 600 }, maxProgress: 10000 },
  { id: "maxFlow", name: "网络流", difficulties: { dynamicProgramming: 0, graphTheory: 920, dataStructures: 420, mathematics: 0, implementation: 600 }, maxProgress: 10000 },
  { id: "persistentSegmentTree", name: "可持久化线段树", difficulties: { dynamicProgramming: 0, graphTheory: 0, dataStructures: 880, mathematics: 0, implementation: 720 }, maxProgress: 10000 },
  { id: "combinatorics", name: "组合计数", difficulties: { dynamicProgramming: 420, graphTheory: 0, dataStructures: 0, mathematics: 860, implementation: 520 }, maxProgress: 10000 },
  { id: "computationalGeometry", name: "计算几何", difficulties: { dynamicProgramming: 0, graphTheory: 360, dataStructures: 0, mathematics: 900, implementation: 680 }, maxProgress: 10000 },
  { id: "compilerOptimization", name: "编译优化", difficulties: { dynamicProgramming: 640, graphTheory: 0, dataStructures: 520, mathematics: 0, implementation: 940 }, maxProgress: 10000 },
  { id: "dynamicConnectivity", name: "动态连通性", difficulties: { dynamicProgramming: 0, graphTheory: 780, dataStructures: 840, mathematics: 0, implementation: 620 }, maxProgress: 10000 },
  { id: "matrixPower", name: "矩阵快速幂", difficulties: { dynamicProgramming: 500, graphTheory: 0, dataStructures: 0, mathematics: 820, implementation: 560 }, maxProgress: 10000 }
]);

export const LEVELS = freeze([
  {
    id: "morningTraining",
    name: "清晨训练场",
    seed: "A7C4-19",
    maxRounds: 12,
    objective: { type: "count", requiredTopics: 3 },
    topicIds: TOPICS.map(({ id }) => id),
    activeTopicSlots: ["B1", "B2", "B3"],
    studentSlots: ["A1", "A2", "A3"],
    focusMax: 1000,
    focusGain: 200
  }
]);

export const DEFAULT_FORMATION = freeze({ A1: "planner", A2: "graphist", A3: "structurer" });

export function createInitialBattleConfig({ levelId = LEVELS[0].id, seed } = {}) {
  const level = LEVELS.find((item) => item.id === levelId);
  if (!level) throw new Error(`Unknown level: ${levelId}`);

  return {
    level: { ...level, seed: seed ?? level.seed },
    roster: STUDENTS.map((student) => ({
      ...student,
      abilities: { ...student.abilities },
      skills: { normal: { ...student.skills.normal }, burst: { ...student.skills.burst } },
      currentEnergy: student.maxEnergy,
      focus: 0
    })),
    formation: { ...DEFAULT_FORMATION },
    topics: TOPICS.filter((topic) => level.topicIds.includes(topic.id)).map((topic) => ({
      ...topic,
      difficulties: { ...topic.difficulties },
      progress: 0,
      currentDifficulties: { ...topic.difficulties }
    }))
  };
}

