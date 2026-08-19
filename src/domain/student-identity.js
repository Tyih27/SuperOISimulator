import {
  ABILITY_KEYS,
  APTITUDE_ABILITY_RANGES,
  NAME_POOL_VERSION,
  STUDENT_NAME_POOLS,
  STUDENTS,
} from "../data.js";
import { createRng } from "../rng.js";

export const STUDENT_IDENTITY_VERSION = 2;

const studentById = new Map(STUDENTS.map((student) => [student.id, student]));

function requireKnownStudent(studentId) {
  const student = studentById.get(studentId);
  if (!student) throw new Error(`Unknown student: ${studentId}`);
  return student;
}

function requirePool(version) {
  const pool = STUDENT_NAME_POOLS[version];
  if (!pool) throw new Error(`Unknown student name-pool version: ${version}`);
  return pool;
}

function requireAptitude(aptitude) {
  const ranges = APTITUDE_ABILITY_RANGES[aptitude];
  if (!ranges) throw new Error(`Unknown student aptitude: ${aptitude}`);
  return ranges;
}

function randomInteger(rng, [minimum, maximum]) {
  return minimum + Math.floor(rng.next() * (maximum - minimum + 1));
}

export function normalizeStudentName(name) {
  if (typeof name !== "string") throw new Error("Student name must be a string with 1 to 12 visible characters");
  const normalized = name.trim();
  const segments = new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(normalized);
  const visibleCharacters = [...segments].filter(({ segment }) => !/^\s+$/u.test(segment));
  if (
    normalized === ""
    || /[\p{C}]/u.test(normalized)
    || visibleCharacters.length < 1
    || visibleCharacters.length > 12
  ) {
    throw new Error("Student name must contain 1 to 12 visible characters");
  }
  return normalized;
}

export function generateStudentName({ studentId, seed, namePoolVersion = NAME_POOL_VERSION } = {}) {
  requireKnownStudent(studentId);
  if (typeof seed !== "string" && typeof seed !== "number") {
    throw new Error("Student identity seed must be a string or number");
  }
  const pool = requirePool(namePoolVersion);
  const rng = createRng(`${namePoolVersion}:${seed}:${studentId}:name`);
  return `${rng.pick(pool.surnames)}${rng.pick(pool.givenNames)}`;
}

export function generateInitialAbilities({ aptitude, seed, studentId } = {}) {
  requireKnownStudent(studentId);
  const ranges = requireAptitude(aptitude);
  if (typeof seed !== "string" && typeof seed !== "number") {
    throw new Error("Student identity seed must be a string or number");
  }
  const rng = createRng(`${seed}:${studentId}:${aptitude}:abilities`);
  return Object.fromEntries(ABILITY_KEYS.map((key) => [key, randomInteger(rng, ranges[key])]));
}

export function aptitudeForAbilities(abilities, preferredAptitude) {
  const aptitudeEntries = Object.entries(APTITUDE_ABILITY_RANGES);
  const compatible = aptitudeEntries.filter(([, ranges]) => ABILITY_KEYS.every((key) => {
    const value = abilities?.[key];
    const [minimum, maximum] = ranges[key];
    return Number.isInteger(value) && value >= minimum && value <= maximum;
  }));
  const preferred = compatible.find(([aptitude]) => aptitude === preferredAptitude);
  if (preferred) return preferred[0];
  if (compatible.length > 0) return compatible[0][0];
  if (preferredAptitude && APTITUDE_ABILITY_RANGES[preferredAptitude]) return preferredAptitude;
  return "普通";
}

export function createStudentIdentity({
  studentId,
  seed,
  namePoolVersion = NAME_POOL_VERSION,
  aptitude = requireKnownStudent(studentId).defaultAptitude,
  name,
} = {}) {
  requireKnownStudent(studentId);
  requireAptitude(aptitude);
  const generatedName = generateStudentName({ studentId, seed, namePoolVersion });
  return {
    id: studentId,
    name: name === undefined ? generatedName : normalizeStudentName(name),
    aptitude,
    abilities: generateInitialAbilities({ aptitude, seed, studentId }),
  };
}

export function renameStudent(profile, studentId, name) {
  if (!profile?.students?.[studentId]) throw new Error("Student must be owned by the profile");
  profile.students[studentId].name = normalizeStudentName(name);
  return profile;
}
