import { Rules } from "./rules";
import { some, Option } from "./option";
import { Boolable, BoolReturn } from "./boolable";
import { OctaneEntity, OctaneWorld } from "./ecs";

export type GameContext = Option<UnsafeGlobalContext>;

export interface UnsafeGlobalContext {
  readonly rules: Rules;
  readonly world: OctaneWorld;
}

class GlobalContext implements UnsafeGlobalContext {
  private static _instance: GlobalContext;
  readonly rules: Rules;
  readonly world: OctaneWorld;

  private constructor() {
    this.world = new OctaneWorld();
    this.rules = new Rules();
  }

  public static getGlobal(ctx: GameContext): UnsafeGlobalContext {
    if (ctx.isSome()) return ctx.get()!;
    return this._instance || (this._instance = new this());
  }

  public static resetGlobal(ctx: GameContext): GameContext {
    if (ctx.isSome()) return createTestGlobal();
    this._instance = new this();
    return some(this._instance);
  }
}

class TestGlobalContext implements UnsafeGlobalContext {
  readonly rules: Rules;
  readonly world: OctaneWorld;

  constructor() {
    this.world = new OctaneWorld();
    this.rules = new Rules();
  }
}

export function resolveGlobalForEntityCreation(ctx: GameContext): GameContext {
  return some(GlobalContext.getGlobal(ctx));
}

export function createTestGlobal(): GameContext {
  return some(new TestGlobalContext());
}

export function resetGlobal(ctx: GameContext): GameContext {
  return GlobalContext.resetGlobal(ctx);
}

export function getRule(ctx: GameContext, name: string): Option<Boolable> {
  return GlobalContext.getGlobal(ctx).rules.get(name);
}

export function addRule(ctx: GameContext, name: string, rule: Boolable): boolean {
  return GlobalContext.getGlobal(ctx).rules.push(name, rule);
}

export function createEntity(ctx: GameContext, startsActive?: BoolReturn, name?: string): OctaneEntity {
  return GlobalContext.getGlobal(ctx).world.createEntity(ctx, startsActive, name);
}

export function getEntity(ctx: GameContext, name: string): OctaneEntity {
  return GlobalContext.getGlobal(ctx).world.getEntity(name);
}

export function clk(ctx: GameContext, useTurnStep: boolean): void {
  return GlobalContext.getGlobal(ctx).world.clk(useTurnStep);
}
