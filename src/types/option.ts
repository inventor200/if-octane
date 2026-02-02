export class Option<T> {
  private contained: T | null;

  constructor(item: T | null) {
    this.contained = item;
  }

  public isSome(): boolean {
    return this.contained !== null;
  }

  public isNone(): boolean {
    return this.contained === null;
  }

  public get(): T | null {
    if (this.isNone()) {
      console.error("Tried to access an empty option!");
    }

    return this.contained;
  }
}

export function some<T>(item: T): Option<T> {
  return new Option<T>(item);
}

export function none<T>(): Option<T> {
  return new Option<T>(null);
}
