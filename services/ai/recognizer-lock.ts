/**
 * The phone has one speech recognizer: a live take and a file transcription must not
 * overlap. Each holds this lock while it uses the recognizer.
 */
let tail: Promise<void> = Promise.resolve();

/** Waits for the recognizer; call the returned function to hand it back. */
export function acquireRecognizer(): Promise<() => void> {
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  const turn = tail.then(() => release);
  tail = tail.then(() => held);
  return turn;
}
