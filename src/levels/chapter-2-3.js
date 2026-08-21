const level = {
  id: "chapter-2-3",
  name: "季度大考",
  order: 7,
  recommendedTotalPower: 20000,
  seed: "H8D6-95",
  maxRounds: 34,
  objective: { type: "all" },
  topicIds: ["exam-treeKnapsack", "exam-maxFlow", "exam-persistentSegmentTree", "exam-combinatorics", "exam-computationalGeometry", "exam-compilerOptimization", "exam-dynamicConnectivity", "exam-matrixPower"],
  activeTopicSlots: ["B1", "B2", "B3"],
  studentSlots: ["A1", "A2", "A3"],
  focusMax: 1000,
  focusGain: 200,
  reward: { trainingCoins: 900, inventory: { "specialist-book-mathematics": 1, "specialist-book-implementation": 1 }, recruitmentTickets: 2, unlockLevelId: "chapter-2-4" },
};

export default level;
