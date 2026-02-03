export type BoolReturn = (Boolable | (() => boolean) | boolean);

export interface Boolable {
  setActive: (newMain: BoolReturn) => Boolable,
  and: (...conditions: BoolReturn[]) => Boolable,
  or: (...conditions: BoolReturn[]) => Boolable,
  nand: (...conditions: BoolReturn[]) => Boolable,
  nor: (...conditions: BoolReturn[]) => Boolable,
  isActive: () => boolean,
  readonly isBoolable: true
};

export function isBoolable(value: any): boolean {
  if (typeof value !== 'object') return false;
  if (!value.isBoolable) return false;
  if (!value.setActive) return false;
  if (!value.and) return false;
  if (!value.or) return false;
  if (!value.nand) return false;
  if (!value.nor) return false;
  if (!value.isActive) return false;
  if (typeof value.setActive !== 'function') return false;
  if (typeof value.and !== 'function') return false;
  if (typeof value.or !== 'function') return false;
  if (typeof value.nand !== 'function') return false;
  if (typeof value.nor !== 'function') return false;
  if (typeof value.isActive !== 'function') return false;
  return true;
}

export function evaluateBoolReturn(value: BoolReturn): boolean {
  if (isBoolable(value)) {
    return (value as Boolable).isActive();
  }

  if (typeof value === 'function') {
    return (value as (() => boolean))();
  }

  return value as boolean;
}
