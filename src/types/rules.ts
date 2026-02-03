import { Boolable } from "./boolable";
import { none, Option, some } from "./option";

export class Rules {
  private readonly ruleMap: Map<string, Boolable>;

  public constructor() {
    this.ruleMap = new Map();
  }

  public push(name: string, rule: Boolable): boolean {
    const search = toSearchTerm(name);

    if (this.ruleMap.has(search)) return false;

    this.ruleMap.set(search, rule);

    return true;
  }

  public get(name: string): Option<Boolable> {
    const search = toSearchTerm(name);

    if (!this.ruleMap.has(search)) return none();

    const found = this.ruleMap.get(search)!;

    return some(found);
  }
}

function toSearchTerm(name: string): string {
  const oldName = name.trim().toLowerCase();

  let newName = "";

  for (let i = 0; i < oldName.length; i++) {
    const c = oldName[i];
    if (c === ' ' || c === '-') newName += '_';
    else newName += c;
  }

  return newName;
}
