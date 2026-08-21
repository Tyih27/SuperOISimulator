import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { LEVELS, STUDENTS, TOPICS } from "../src/data.js";
import { createProfile } from "../src/domain/profile.js";
import { CombatEngine } from "../src/combat/engine.js";

const SLOT_IDS = Object.freeze(["A1", "A2", "A3"]);
const studentById = new Map(STUDENTS.map((student) => [student.id, student]));
const topicById = new Map(TOPICS.map((topic) => [topic.id, topic]));

function combinations(ids, size = 3) {
  const results = [];
  const visit = (start, selected) => {
    if (selected.length === size) {
      results.push(selected);
      return;
    }
    for (let index = start; index <= ids.length - (size - selected.length); index += 1) {
      visit(index + 1, [...selected, ids[index]]);
    }
  };
  visit(0, []);
  return results;
}

function permutations(ids) {
  if (ids.length === 0) return [[]];
  return ids.flatMap((id, index) => permutations([...ids.slice(0, index), ...ids.slice(index + 1)])
    .map((rest) => [id, ...rest]));
}

function validateInput({ levelId, seeds, rosterIds }) {
  const level = LEVELS.find((candidate) => candidate.id === levelId);
  if (!level) throw new Error(`Unknown level: ${levelId}`);
  if (!Array.isArray(seeds) || seeds.length === 0 || seeds.some((seed) => typeof seed !== "string" && !Number.isFinite(seed))) {
    throw new Error("Simulation seeds must be a non-empty array of strings or finite numbers");
  }
  if (!Array.isArray(rosterIds) || rosterIds.length < 3 || new Set(rosterIds).size !== rosterIds.length) {
    throw new Error("Simulation rosterIds must contain at least three different students");
  }
  const roster = STUDENTS.filter(({ id }) => rosterIds.includes(id));
  if (roster.length !== rosterIds.length) {
    const unknownId = rosterIds.find((id) => !studentById.has(id));
    throw new Error(`Unknown simulation student: ${unknownId}`);
  }
  return { level, rosterIds: roster.map(({ id }) => id), seeds: [...seeds] };
}

function aggregate(teamIds, positions, level, seeds) {
  const totals = {
    wins: 0,
    rounds: 0,
    remainingEnergy: 0,
    completedTopics: 0,
    normalSkillCount: 0,
    burstSkillCount: 0,
  };
  const topics = level.topicIds.map((topicId) => topicById.get(topicId));

  for (const seed of seeds) {
    const simulationProfile = createProfile({ accountId: `balance-${seed}`, identitySeed: `balance-${seed}`, studentIds: teamIds });
    const battle = new CombatEngine({
      level,
      seed,
      students: teamIds.map((studentId) => simulationProfile.students[studentId]),
      topics,
      teamIds,
      positions,
      initialActiveTopicIds: level.topicIds.slice(0, 3),
    }).run();
    totals.wins += battle.result === "win" ? 1 : 0;
    totals.rounds += battle.round;
    totals.remainingEnergy += battle.remainingEnergy;
    totals.completedTopics += battle.completedCount;
    for (const entry of battle.events) {
      if (entry.type !== "action" || !teamIds.includes(entry.actor)) continue;
      if (entry.burst) totals.burstSkillCount += 1;
      else totals.normalSkillCount += 1;
    }
  }

  return {
    formation: [...teamIds],
    formationId: teamIds.join(","),
    positions: Object.fromEntries(SLOT_IDS.map((slot, index) => [slot, positions[slot]])),
    positionId: SLOT_IDS.map((slot) => positions[slot]).join(","),
    simulations: seeds.length,
    winRate: totals.wins / seeds.length,
    averageRounds: totals.rounds / seeds.length,
    averageRemainingEnergy: totals.remainingEnergy / seeds.length,
    averageCompletedTopics: totals.completedTopics / seeds.length,
    normalSkillCount: totals.normalSkillCount,
    burstSkillCount: totals.burstSkillCount,
  };
}

export function simulate(input) {
  const { level, rosterIds, seeds } = validateInput(input);
  const rows = combinations(rosterIds).flatMap((formation) => permutations(formation).map((permutation) => {
    const positions = Object.fromEntries(SLOT_IDS.map((slot, index) => [slot, permutation[index]]));
    return aggregate(formation, positions, level, seeds);
  }));
  const totalSimulations = rows.reduce((sum, row) => sum + row.simulations, 0);
  const totalWins = rows.reduce((sum, row) => sum + row.winRate * row.simulations, 0);

  return {
    levelId: level.id,
    rosterIds,
    seeds: seeds.length,
    seedValues: seeds,
    formations: combinations(rosterIds).length,
    permutationsPerFormation: 6,
    simulations: totalSimulations,
    overallWinRate: totalWins / totalSimulations,
    rows,
  };
}

export function toCsv(report) {
  const headers = [
    "levelId", "formation", "A1", "A2", "A3", "simulations", "winRate", "averageRounds",
    "averageRemainingEnergy", "averageCompletedTopics", "normalSkillCount", "burstSkillCount",
  ];
  const value = (item) => `"${String(item).replaceAll('"', '""')}"`;
  const lines = report.rows.map((row) => [
    report.levelId,
    row.formationId,
    row.positions.A1,
    row.positions.A2,
    row.positions.A3,
    row.simulations,
    row.winRate,
    row.averageRounds,
    row.averageRemainingEnergy,
    row.averageCompletedTopics,
    row.normalSkillCount,
    row.burstSkillCount,
  ].map(value).join(","));
  return `${headers.join(",")}\n${lines.join("\n")}\n`;
}

export async function writeReport(report, outputPath) {
  const jsonPath = resolve(outputPath);
  const csvPath = jsonPath.endsWith(".json") ? `${jsonPath.slice(0, -5)}.csv` : `${jsonPath}.csv`;
  await mkdir(dirname(jsonPath), { recursive: true });
  await Promise.all([
    writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`),
    writeFile(csvPath, toCsv(report)),
  ]);
  return { jsonPath, csvPath };
}

function parseSeeds(value) {
  if (!value) throw new Error("--seeds is required");
  return value.split(",").map((seed) => {
    const trimmed = seed.trim();
    if (trimmed === "") throw new Error("--seeds must not contain an empty value");
    const numeric = Number(trimmed);
    return Number.isFinite(numeric) && String(numeric) === trimmed ? numeric : trimmed;
  });
}

function parseArguments(args) {
  const options = { all: false };
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--all") options.all = true;
    else if (["--level", "--seeds", "--out", "--out-dir"].includes(argument)) options[argument.slice(2).replaceAll("-", "_")] = args[++index];
    else throw new Error(`Unknown argument: ${argument}`);
  }
  if (options.all && options.level) throw new Error("Use either --all or --level, not both");
  if (!options.all && !options.level) throw new Error("Specify --level <levelId> or --all");
  if (options.all && options.out) throw new Error("Use --out-dir with --all");
  if (!options.all && !options.out) throw new Error("--out is required when simulating one level");
  if (options.all && !options.out_dir) throw new Error("--out-dir is required with --all");
  return options;
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const seeds = parseSeeds(options.seeds);
  const levelIds = options.all ? LEVELS.map(({ id }) => id) : [options.level];
  const reports = [];
  for (const levelId of levelIds) {
    const report = simulate({ levelId, seeds, rosterIds: STUDENTS.map(({ id }) => id) });
    const outputPath = options.all
      ? resolve(options.out_dir, `${levelId}.json`)
      : options.out;
    const paths = await writeReport(report, outputPath);
    reports.push({ levelId, ...paths, overallWinRate: report.overallWinRate });
  }
  process.stdout.write(`${JSON.stringify(reports, null, 2)}\n`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}
