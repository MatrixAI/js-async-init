type Status = 'destroying' | 'starting' | 'stopping' | null;

type Class<T> = new (...args: any[]) => T;

export type { Status, Class };
