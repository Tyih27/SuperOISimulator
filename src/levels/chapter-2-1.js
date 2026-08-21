const level = {
  id: "chapter-2-1",
  name: "午夜加练",
  order: 5,
  track: "extra",
  recommendedTotalPower: 4800,
  seed: "F4B2-53",
  maxRounds: 30,
  objective: { type: "all" },
  topicIds: ["drill-treeKnapsack", "drill-maxFlow", "drill-persistentSegmentTree", "drill-combinatorics", "drill-computationalGeometry", "drill-compilerOptimization", "drill-dynamicConnectivity", "drill-matrixPower"],
  activeTopicSlots: ["B1", "B2", "B3"],
  studentSlots: ["A1", "A2", "A3"],
  focusMax: 1000,
  focusGain: 200,
  reward: { trainingCoins: 400, inventory: { "specialist-book-dynamicProgramming": 1, "specialist-book-graphTheory": 1 }, recruitmentTickets: 1, unlockLevelId: "chapter-2-2" },
};

export default level;
