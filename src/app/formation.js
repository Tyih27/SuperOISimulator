const FORMATION_SLOTS = Object.freeze(["A1", "A2", "A3"]);

export class FormationController {
  constructor(roster, positions = null) {
    if (!Array.isArray(roster) || new Set(roster).size !== roster.length) {
      throw new Error("Roster must contain unique student IDs");
    }

    this.roster = [...roster];
    this.positions = Object.fromEntries(
      FORMATION_SLOTS.map((slot, index) => [slot, positions?.[slot] ?? roster[index] ?? null]),
    );
    this.error = null;
  }

  get selectedIds() {
    return FORMATION_SLOTS.map((slot) => this.positions[slot]).filter(Boolean);
  }

  get isValid() {
    return this.selectedIds.length === FORMATION_SLOTS.length
      && new Set(this.selectedIds).size === FORMATION_SLOTS.length
      && this.selectedIds.every((studentId) => this.roster.includes(studentId));
  }

  toggle(studentId) {
    this.assertKnownStudent(studentId);
    if (this.selectedIds.includes(studentId)) return this.replace(studentId, null);

    const openSlot = FORMATION_SLOTS.find((slot) => !this.positions[slot]);
    if (!openSlot) {
      this.error = "每场只能选择 3 名学生";
      return false;
    }

    return this.assign(openSlot, studentId);
  }

  replace(outgoingId, incomingId) {
    const slot = FORMATION_SLOTS.find((position) => this.positions[position] === outgoingId);
    if (!slot) return false;
    return this.assign(slot, incomingId);
  }

  assign(slot, studentId) {
    if (!FORMATION_SLOTS.includes(slot)) throw new Error("Unknown formation slot");
    if (studentId !== null) this.assertKnownStudent(studentId);
    if (studentId && this.selectedIds.some((id) => id === studentId && this.positions[slot] !== studentId)) {
      this.error = "同一名学生不能占据多个位置";
      return false;
    }

    this.positions[slot] = studentId;
    this.error = null;
    return true;
  }

  assertKnownStudent(studentId) {
    if (!this.roster.includes(studentId)) throw new Error("Unknown student");
  }
}

export { FORMATION_SLOTS };
