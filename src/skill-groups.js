/**
 * ─── 学生技能组总表（唯一可编辑来源）────────────────────────────────────────
 *
 * 每个技能组包含 normal（常规）与 burst（爆发）两个技能。
 * 学生通过 STUDENTS 中的 `skillGroupId` 引用本表中的一个组。
 *
 * 解题技能 problemSkill 字段：
 *   targetRule       目标选择规则，可选值见下
 *   skillMultiplier  技能倍率（乘在基线进度上）
 *   targetMultiplier 目标倍率（多目标时的分配系数）
 *   flatBonus        固定进度加成
 *   focusGain        常规施放获得的专注（默认 200）
 *
 * 辅助技能 supportSkill 字段：
 *   effectType "energyRestore" 恢复精力 / "focusGain" 增加专注
 *   amount     固定效果数值
 *   focusGain  常规施放获得的专注（默认 200）
 *
 * targetRule 可选值：
 *   题目：lowestRemaining 剩余最低 / highestDifficulty 难度最高 /
 *         bestMatch 最佳匹配 / alignedFirst 对位优先 /
 *         allProblems 全部题目 / random 随机 / twoBestMatch 前二匹配
 *   学生：lowestEnergy 精力最低 / lowestFocus 专注最低 /
 *         allStudents 全体学生 / matchingPosition 正对位置
 */

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
  amount: 0,
  ...skill
});

export const SKILL_GROUPS = freeze({
  planner: {
    id: "planner",
    name: "拆解思路",
    skills: {
      normal: problemSkill({ id: "planner-normal", name: "逐个击破", targetRule: "lowestRemaining" }),
      burst: problemSkill({ id: "planner-burst", name: "关键路径", targetRule: "highestDifficulty", skillMultiplier: 1.5 })
    }
  },
  graphist: {
    id: "graphist",
    name: "图论直觉",
    skills: {
      normal: problemSkill({ id: "graphist-normal", name: "匹配攻击", targetRule: "bestMatch" }),
      burst: problemSkill({ id: "graphist-burst", name: "割点突破", targetRule: "highestDifficulty", skillMultiplier: 1.35, flatBonus: 120 })
    }
  },
  structurer: {
    id: "structurer",
    name: "结构维护",
    skills: {
      normal: supportSkill({ id: "structurer-normal", name: "稳态修复", targetRule: "lowestEnergy", effectType: "energyRestore", amount: 650 }),
      burst: supportSkill({ id: "structurer-burst", name: "全队整备", targetRule: "allStudents", effectType: "energyRestore", amount: 420 })
    }
  },
  mathematician: {
    id: "mathematician",
    name: "严密推导",
    skills: {
      normal: problemSkill({ id: "mathematician-normal", name: "精确推导", targetRule: "bestMatch", skillMultiplier: 1.1 }),
      burst: problemSkill({ id: "mathematician-burst", name: "极限证明", targetRule: "highestDifficulty", skillMultiplier: 1.6 })
    }
  },
  implementer: {
    id: "implementer",
    name: "工程执行",
    skills: {
      normal: problemSkill({ id: "implementer-normal", name: "稳定输出", targetRule: "alignedFirst" }),
      burst: problemSkill({ id: "implementer-burst", name: "连续提交", targetRule: "lowestRemaining", skillMultiplier: 1.25, targetMultiplier: 0.8, flatBonus: 240 })
    }
  },
  supporter: {
    id: "supporter",
    name: "团队协作",
    skills: {
      normal: supportSkill({ id: "supporter-normal", name: "专注鼓舞", targetRule: "lowestFocus", effectType: "focusGain", amount: 120 }),
      burst: supportSkill({ id: "supporter-burst", name: "集体增益", targetRule: "allStudents", effectType: "focusGain", amount: 180 })
    }
  }
});
