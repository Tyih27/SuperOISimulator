const level = {
  id: "chapter-1-3",
  name: "专题测验",
  order: 3,
  recommendedTotalPower: 2475,
  seed: "C9D2-71",
  maxRounds: 16,
  objective: { type: "all" },
  topicIds: ["maxFlow", "persistentSegmentTree", "combinatorics", "computationalGeometry"],
  activeTopicSlots: ["B1", "B2", "B3"],
  studentSlots: ["A1", "A2", "A3"],
  focusMax: 1000,
  focusGain: 200,
  reward: { trainingCoins: 190, inventory: { "specialist-book-mathematics": 1, "specialist-book-implementation": 1 }, unlockLevelId: "chapter-1-4" },
};

export default level;
