const level = {
  id: "chapter-2-5",
  name: "冬令营选拔",
  order: 9,
  track: "extra",
  recommendedTotalPower: 40200,
  seed: "K2F4-57",
  maxRounds: 36,
  objective: { type: "all" },
  topicIds: ["winter-treeKnapsack", "winter-maxFlow", "winter-persistentSegmentTree", "winter-combinatorics", "winter-computationalGeometry", "winter-compilerOptimization", "winter-dynamicConnectivity", "winter-matrixPower"],
  activeTopicSlots: ["B1", "B2", "B3"],
  studentSlots: ["A1", "A2", "A3"],
  focusMax: 1000,
  focusGain: 200,
  reward: { trainingCoins: 2000, inventory: { "specialist-book-dynamicProgramming": 1, "specialist-book-graphTheory": 1 }, recruitmentTickets: 3, unlockLevelId: "chapter-2-6" },
};

export default level;
