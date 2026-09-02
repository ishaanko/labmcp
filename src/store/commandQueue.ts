/**
 * Serializes every dispatch (human clicks, WebMCP tool calls, the ticker) onto one FIFO tail so
 * "human acts while agent acts" never interleaves two commands against the same state read.
 * A throwing job does not stall the queue: the tail always resolves, even after a job rejects.
 */
let tail: Promise<unknown> = Promise.resolve();
let depth = 0;

export function enqueue<T>(job: () => T | Promise<T>): Promise<T> {
  depth++;
  const run = tail.then(job, job).finally(() => {
    depth--;
  });
  tail = run.catch(() => undefined);
  return run;
}

export const queueDepth = (): number => depth;
