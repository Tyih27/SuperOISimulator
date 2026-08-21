const level = {
  id: "chapter-1-4",
  name: "黄昏模拟赛",
  order: 4,
  recommendedAbility: 850,
  seed: "D5A6-88",
  maxRounds: 18,
  objective: { type: "all" },
  topicIds: ["treeKnapsack", "maxFlow", "persistentSegmentTree", "combinatorics", "computationalGeometry", "compilerOptimization", "dynamicConnectivity", "matrixPower"],
  activeTopicSlots: ["B1", "B2", "B3"],
  studentSlots: ["A1", "A2", "A3"],
  focusMax: 1000,
  focusGain: 200,
  reward: { trainingCoins: 260, inventory: { "specialist-book-dynamicProgramming": 1, "specialist-book-graphTheory": 1 }, recruitmentTickets: 1, unlockLevelId: "chapter-2-1" },
};

export default level;
