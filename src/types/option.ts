export class Option<T> {
  private contained: T | null;

  constructor(item: T | null) {
    this.contained = item;
  }

  public isSome(): boolean {
    return !this.isNone();
  }

  public isNone(): boolean {
    return filterDestroyable(this.contained) === null;
  }

  public get(): T | null {
    this.contained = filterDestroyable(this.contained);
    return this.contained;
  }
}

export function some<T>(item: T): Option<T> {
  return new Option<T>(filterDestroyable(item));
}

export function none<T>(): Option<T> {
  return new Option<T>(null);
}

function filterDestroyable<T>(obj: T | null | undefined): T | null {
  if (obj === null) return null;
  if (obj === undefined) return null;

  // Destroyed destroyable objects should be forgotten
  if (typeof obj === 'object') {
    const obj0 = obj as any;
    const isDestroyable = !(!obj0.isDestroyable);
    const isDestroyed = !(!obj0.isDestroyed);
    if (isDestroyable && isDestroyed) return null;
  }
    
  return obj;
}
