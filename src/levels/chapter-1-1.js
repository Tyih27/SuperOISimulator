const level = {
  id: "chapter-1-1",
  name: "清晨训练场",
  order: 1,
  recommendedAbility: 625,
  seed: "A7C4-19",
  maxRounds: 12,
  objective: { type: "count", requiredTopics: 2 },
  topicIds: ["treeKnapsack", "maxFlow", "persistentSegmentTree", "combinatorics", "computationalGeometry", "compilerOptimization", "dynamicConnectivity", "matrixPower"],
  activeTopicSlots: ["B1", "B2", "B3"],
  studentSlots: ["A1", "A2", "A3"],
  focusMax: 1000,
  focusGain: 200,
  reward: { trainingCoins: 100, inventory: { "specialist-book-dynamicProgramming": 1 }, unlockLevelId: "chapter-1-2" },
};

export default level;
