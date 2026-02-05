import { Rules } from "./rules";
import { Option } from "./option";
import { Boolable, BoolReturn } from "./boolable";
import { OctaneEntity, OctaneWorld } from "./ecs";

class GlobalContext {
  private static _instance: GlobalContext;
  readonly rules: Rules;
  readonly world: OctaneWorld;

  private constructor() {
    this.world = new OctaneWorld();
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

export function createEntity(startsActive?: BoolReturn, name?: string): Option<OctaneEntity> {
  return GlobalContext.getGlobal().world.createEntity(startsActive, name);
}

export function getEntity(name: string): Option<OctaneEntity> {
  return GlobalContext.getGlobal().world.getEntity(name);
}

export function clk(useTurnStep: boolean): void {
  return GlobalContext.getGlobal().world.clk(useTurnStep);
}
