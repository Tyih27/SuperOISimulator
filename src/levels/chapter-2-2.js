const level = {
  id: "chapter-2-2",
  name: "周末集训",
  order: 6,
  recommendedTotalPower: 10000,
  seed: "G6C4-74",
  maxRounds: 32,
  objective: { type: "all" },
  topicIds: ["camp-treeKnapsack", "camp-maxFlow", "camp-persistentSegmentTree", "camp-combinatorics", "camp-computationalGeometry", "camp-compilerOptimization", "camp-dynamicConnectivity", "camp-matrixPower"],
  activeTopicSlots: ["B1", "B2", "B3"],
  studentSlots: ["A1", "A2", "A3"],
  focusMax: 1000,
  focusGain: 200,
  reward: { trainingCoins: 600, inventory: { "specialist-book-dataStructures": 1, "specialist-book-mathematics": 1 }, recruitmentTickets: 1, unlockLevelId: "chapter-2-3" },
};

export default level;
