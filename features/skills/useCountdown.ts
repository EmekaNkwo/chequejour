import { useEffect, useRef, useState } from 'react';

export interface Countdown {
  /** Seconds left, rounded up. */
  remaining: number;
  running: boolean;
  start: (seconds: number) => void;
  stop: () => void;
}

/**
 * A wall-clock countdown: it measures against Date.now(), so it stays correct if the
 * JS thread stalls or the app is briefly backgrounded. `onDone` fires once at zero.
 */
export function useCountdown(onDone: () => void): Countdown {
  const [endsAt, setEndsAt] = useState<number | null>(null);
  const [remaining, setRemaining] = useState(0);
  const doneRef = useRef(onDone);
  useEffect(() => {
    doneRef.current = onDone;
  });

  useEffect(() => {
    if (endsAt === null) return;
    // Several ticks can run before the re-render that clears endsAt; only the first ends it.
    let fired = false;
    const tick = () => {
      if (fired) return;
      const left = Math.max(0, (endsAt - Date.now()) / 1000);
      setRemaining(Math.ceil(left));
      if (left <= 0) {
        fired = true;
        setEndsAt(null);
        doneRef.current();
      }
    };
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [endsAt]);

  return {
    remaining,
    running: endsAt !== null,
    start: (seconds) => {
      setRemaining(seconds);
      setEndsAt(Date.now() + seconds * 1000);
    },
    stop: () => setEndsAt(null),
  };
}
