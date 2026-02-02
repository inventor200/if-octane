import { Rules } from "./rules";
import { Option } from "./option";
import { Boolable } from "./boolable";

class GlobalContext {
  private static _instance: GlobalContext;
  readonly rules: Rules;

  private constructor() {
    this.rules = new Rules();
  }

  public static getGlobal() {
    return this._instance || (this._instance = new this());
  }

  public static resetGlobal() {
    this._instance = new this();
  }
}

export function resetGlobal(): void {
  return GlobalContext.resetGlobal();
}

export function getRule(name: string): Option<Boolable> {
  return GlobalContext.getGlobal().rules.get(name);
}

export function addRule(name: string, rule: Boolable): boolean {
  return GlobalContext.getGlobal().rules.push(name, rule);
}
