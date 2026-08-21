const level = {
  id: "chapter-2-4",
  name: "全国模拟赛",
  order: 8,
  recommendedTotalPower: 30000,
  seed: "J2E8-16",
  maxRounds: 36,
  objective: { type: "all" },
  topicIds: ["national-treeKnapsack", "national-maxFlow", "national-persistentSegmentTree", "national-combinatorics", "national-computationalGeometry", "national-compilerOptimization", "national-dynamicConnectivity", "national-matrixPower"],
  activeTopicSlots: ["B1", "B2", "B3"],
  studentSlots: ["A1", "A2", "A3"],
  focusMax: 1000,
  focusGain: 200,
  reward: { trainingCoins: 1500, inventory: { "specialist-book-dynamicProgramming": 2, "specialist-book-graphTheory": 2 }, recruitmentTickets: 3 },
};

export default level;
