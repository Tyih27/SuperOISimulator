const level = {
  id: "chapter-1-2",
  name: "图论午练",
  order: 2,
  recommendedAbility: 725,
  seed: "B3F8-42",
  maxRounds: 14,
  objective: { type: "count", requiredTopics: 3 },
  topicIds: ["treeKnapsack", "maxFlow", "persistentSegmentTree", "combinatorics", "computationalGeometry"],
  activeTopicSlots: ["B1", "B2", "B3"],
  studentSlots: ["A1", "A2", "A3"],
  focusMax: 1000,
  focusGain: 200,
  reward: { trainingCoins: 140, inventory: { "specialist-book-graphTheory": 1, "specialist-book-dataStructures": 1 }, unlockLevelId: "chapter-1-3" },
};

export default level;
