/**
 * Deconstructed promise
 */
type PromiseDeconstructed<T> = {
  p: Promise<T>;
  resolveP: (value: T | PromiseLike<T>) => void;
  rejectP: (reason?: any) => void;
};

type Status = 'destroying' | 'starting' | 'stopping' | null;

type Class<T> = new (...args: any[]) => T;

export type { PromiseDeconstructed, Status, Class };
