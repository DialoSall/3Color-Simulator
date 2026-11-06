import { useCallback, useEffect, useRef, useState } from "react";
import { dailyProgressService, mergeDailyProgress, newDailyAttemptId } from "../services/dailyProgress.js";

export function useDailyProgress(puzzle, service = dailyProgressService, onCompletionSaved) {
  const [progress, setProgress] = useState(null);
  const [progressError, setProgressError] = useState("");
  const attemptId = useRef(null);
  const queue = useRef(Promise.resolve());
  const mounted = useRef(false);
  const completionSaved = useRef(onCompletionSaved);
  useEffect(() => { completionSaved.current = onCompletionSaved; }, [onCompletionSaved]);
  useEffect(() => {
    mounted.current = true;
    let cancelled = false;
    service.getProgress(puzzle).then(record => {
      if (!cancelled) setProgress(previous=>mergeDailyProgress(previous,record));
    }).catch(() => {
      if (!cancelled) setProgressError("Daily progress could not be loaded on this browser. You can still play.");
    });
    return () => { cancelled = true; mounted.current = false; };
  }, [puzzle, service]);

  const enqueue = useCallback(operation => {
    queue.current = queue.current.then(operation).then(record => {
      if (mounted.current) {
        setProgress(previous=>mergeDailyProgress(previous,record));
        setProgressError("");
      }
    }).catch(() => {
      if (mounted.current) setProgressError("Daily progress could not be saved on this browser. Your previous results are preserved.");
    });
  }, []);
  const recordMove = useCallback(() => {
    if (!attemptId.current) attemptId.current = newDailyAttemptId();
    const id = attemptId.current;
    enqueue(()=>service.recordActivity(puzzle,id));
  }, [enqueue,puzzle,service]);
  const recordReset = useCallback(() => {
    if (attemptId.current) {
      const id = attemptId.current;
      enqueue(()=>service.recordActivity(puzzle,id));
    }
  }, [enqueue,puzzle,service]);
  const completeAttempt = useCallback((result, onSaved) => {
    if (!attemptId.current) attemptId.current = newDailyAttemptId();
    const id = attemptId.current;
    enqueue(async () => {
      const record = await service.completeAttempt(puzzle,id,result);
      completionSaved.current?.();
      onSaved?.(record, id);
      return record;
    });
  }, [enqueue,puzzle,service]);
  const replayAttempt = useCallback(() => { attemptId.current = null; }, []);
  return {bestResult: progress?.best ?? null, progressError, recordMove, recordReset, completeAttempt, replayAttempt};
}
