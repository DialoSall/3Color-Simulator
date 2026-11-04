export const TUTORIAL_VERSION = 1;
export const TUTORIAL_PROGRESS_KEY = "3color-campaign-tutorial";

function emptyProgress() {
  return { tutorialVersion: TUTORIAL_VERSION, completed: false, completedAt: null, skipped: false, skippedAt: null };
}

function validProgress(record) {
  return record && Number.isInteger(record.tutorialVersion) && record.tutorialVersion > 0 &&
    typeof record.completed === "boolean" && typeof record.skipped === "boolean" &&
    (!record.completed || Number.isFinite(Date.parse(record.completedAt))) &&
    (!record.skipped || Number.isFinite(Date.parse(record.skippedAt)));
}

export function hasFinishedTutorial(record) {
  return validProgress(record) && record.tutorialVersion >= TUTORIAL_VERSION && (record.completed || record.skipped);
}

// A future account adapter can use these same records and merge semantics.
// Completion wins over a skip; older tutorial versions cannot overwrite newer ones.
export function mergeTutorialProgress(left, right) {
  if (!validProgress(left) || !validProgress(right)) throw new Error("Invalid tutorial progress.");
  if (left.tutorialVersion !== right.tutorialVersion) return { ...(left.tutorialVersion > right.tutorialVersion ? left : right) };
  const earliest = (...dates) => dates.filter(Boolean).sort()[0] ?? null;
  return {
    tutorialVersion: left.tutorialVersion,
    completed: left.completed || right.completed,
    completedAt: earliest(left.completedAt, right.completedAt),
    skipped: left.skipped || right.skipped,
    skippedAt: earliest(left.skippedAt, right.skippedAt),
  };
}

function browserStorage() {
  try { return typeof window === "undefined" ? null : window.localStorage; } catch { return null; }
}

export function createTutorialProgressService({ storage = browserStorage() } = {}) {
  let memory = emptyProgress();
  function read() {
    const raw = storage?.getItem(TUTORIAL_PROGRESS_KEY);
    if (!raw) return memory;
    try {
      const record = JSON.parse(raw);
      return validProgress(record) ? record : emptyProgress();
    } catch { return emptyProgress(); }
  }
  return {
    async getProgress() { return { ...read() }; },
    async saveProgress(record) {
      const merged = mergeTutorialProgress(read(), record);
      if (storage) storage.setItem(TUTORIAL_PROGRESS_KEY, JSON.stringify(merged));
      memory = merged;
      return { ...merged };
    },
  };
}

export const tutorialProgressService = createTutorialProgressService();
