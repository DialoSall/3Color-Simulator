import { useEffect, useRef, useState } from "react";
import { TUTORIAL_VERSION, hasFinishedTutorial, tutorialProgressService } from "../services/tutorialProgress.js";
import { didCompleteTutorialStep, tutorialSteps } from "../utils/campaignTutorial.js";
import { trackEvent } from "../utils/analytics.js";

export function useCampaignTutorial(enabled, service = tutorialProgressService) {
  const [step, setStep] = useState(0);
  const [dismissed, setDismissed] = useState(false);
  const [reinforcement, setReinforcement] = useState(false);
  const [storageError, setStorageError] = useState("");
  const stepRef = useRef(0);

  function event(name, details = {}) {
    trackEvent(name, { game_mode: "campaign", level: 1, tutorial_version: TUTORIAL_VERSION, ...details });
  }
  function changeStep(next) { stepRef.current = next; setStep(next); }

  useEffect(() => {
    let cancelled = false;
    stepRef.current = 0;
    setStep(0);
    setDismissed(false);
    setReinforcement(false);
    setStorageError("");
    if (!enabled) return;
    function initialize(record) {
      if (cancelled) return;
      const finished = hasFinishedTutorial(record);
      setDismissed(finished);
      if (!finished) {
        stepRef.current = 1;
        setStep(1);
        trackEvent("tutorial_start", { game_mode: "campaign", level: 1, tutorial_version: TUTORIAL_VERSION, entry: "automatic" });
      }
    }
    service.getProgress().then(initialize).catch(() => {
      if (!cancelled) {
        setStorageError("Tutorial preferences are unavailable. You can still play or skip.");
        initialize(null);
      }
    });
    return () => { cancelled = true; };
  }, [enabled, service]);

  function save(skipped) {
    const timestamp = new Date().toISOString();
    service.saveProgress({ tutorialVersion: TUTORIAL_VERSION, completed: !skipped, completedAt: skipped ? null : timestamp, skipped, skippedAt: skipped ? timestamp : null })
      .catch(() => setStorageError("Your tutorial preference could not be saved. It may appear again next visit."));
    setDismissed(true);
  }

  const activeStep = enabled ? step : 0;
  return {
    step: activeStep,
    guidance: tutorialSteps[activeStep],
    canReplay: enabled && dismissed && !activeStep,
    reinforcement: enabled && reinforcement,
    storageError: enabled ? storageError : "",
    canColor(vertexId) { return !enabled || !stepRef.current || !tutorialSteps[stepRef.current].allowedIds || tutorialSteps[stepRef.current].allowedIds.includes(vertexId); },
    onMove(vertexId, vertices, edges) {
      const current = stepRef.current;
      if (!enabled || !didCompleteTutorialStep(current, vertexId, vertices, edges)) return;
      event("tutorial_step_complete", { step_number: current, step_name: tutorialSteps[current].name });
      if (current === 4) {
        changeStep(0);
        setReinforcement(true);
        save(false);
        event("tutorial_complete");
      } else changeStep(current + 1);
    },
    skip() {
      if (!enabled || !stepRef.current) return;
      event("tutorial_skip", { step_number: stepRef.current, step_name: tutorialSteps[stepRef.current].name });
      changeStep(0);
      save(true);
    },
    replay() {
      if (!enabled) return;
      setReinforcement(false);
      changeStep(1);
      event("tutorial_replay");
      event("tutorial_start", { entry: "replay" });
    },
    reset() {
      setReinforcement(false);
      if (enabled && stepRef.current) changeStep(1);
    },
  };
}
