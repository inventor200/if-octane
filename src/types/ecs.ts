import { Boolable, BoolReturn, isBoolable } from "./boolable";
import { BoolTree } from "./bool-tree";
import { none, Option, some } from "./option";
import { toSearchTerm } from "./util";
import { GameContext, resolveGlobalForEntityCreation } from "./global-context";

export type OctaneEntity = Option<UnsafeOctaneEntity>;

export class OctaneWorld {
  private readonly entities: Map<string, OctaneEntity>;
  private anonymousCount: number;
  
  public constructor() {
    this.entities = new Map();
    this.anonymousCount = 0;
  }

  private createAnonymousName(): string {
    const name = "anonymous_entity" + String(this.anonymousCount);
    this.anonymousCount++;
    return name;
  }

  public createEntity(ctx: GameContext, startsActive?: BoolReturn, name?: string): OctaneEntity {
    if (name === undefined) name = this.createAnonymousName();
    const newName = toSearchTerm(name);
    
    if (newName.length === 0) {
      console.error("Error while creating entity with empty name!");
      return this.createEntity(ctx, startsActive);
    }
    
    if (this.entities.has(newName)) {
      console.error("Error trying to recreate " + newName + "!");
      return this.createEntity(ctx, startsActive, newName + "_dup");
    }

    const entity = new UnsafeOctaneEntity(ctx, startsActive);
    this.entities.set(newName, some(entity));

    // Send back a separate wrapper, juuuuust in case
    return some(entity);
  }

  public getEntity(name: string): OctaneEntity {
    if (!this.entities.has(name)) return none();
    
    const retrieved = this.entities.get(name)!.get();

    if (retrieved === null) {
      this.entities.delete(name);
      return none();
    }

    // Send back a separate wrapper, juuuuust in case
    return some(retrieved);
  }

  public clk(useTurnStep: boolean): void {
    const destroyedEntities: string[] = [];
    
    for (const [key, value] of this.entities) {
      const entity = value.get();
      if (entity === null) {
        // Mark for cleanup
        destroyedEntities.push(key);
      }
      else {
        // Iterate
        entity.clk(useTurnStep);
      }
    }

    // Trim destroyed entities from map for GC to claim
    for (let i = 0; i < destroyedEntities.length; i++) {
      this.entities.delete(destroyedEntities[i]);
    }
  }
}

export interface Destroyable {
  readonly isDestroyable: true;
  isDestroyed: false | true;
};

// Named "unsafe" to encourage using the wrapper type
export class UnsafeOctaneEntity implements Boolable, Destroyable {
  public readonly isBoolable: true;
  public readonly isDestroyable: true;
  private readonly activeSwitch: Boolable;
  isDestroyed: boolean;
  public readonly components: OctaneComponent[];
  public readonly ctx: GameContext;

  constructor(ctx: GameContext, startsActive?: BoolReturn) {
    this.ctx = resolveGlobalForEntityCreation(ctx);
    this.isBoolable = true;
    this.isDestroyable = true;
    this.isDestroyed = false;
    if (startsActive === undefined) {
      this.activeSwitch = new BoolTree(true);
    }
    else if (isBoolable(startsActive)) {
      this.activeSwitch = startsActive as Boolable;
    }
    else {
      this.activeSwitch = new BoolTree(startsActive);
    }

    this.components = [];
  }

  public add(...components: OctaneComponent[]): UnsafeOctaneEntity {
    for (let i = 0; i < components.length; i++) {
      this.components.push(components[i]);
    }

    return this;
  }

  public remove(...components: OctaneComponent[]): OctaneComponent[] {
    const removed: OctaneComponent[] = [];

    if (components.length === 0) return removed;

    for (let i = 0; i < this.components.length; i++) {
      const installedComponent = this.components[i];
      for (let j = 0; j < components.length; j++) {
        const targetComponent = components[j];

        if (installedComponent === targetComponent) {
          removed.push(installedComponent);
          this.components.splice(i, 1);
          i--;
          break;
        }
      }
    }

    return removed;
  }

  public isActive(): boolean {
    return !this.isDestroyed && this.activeSwitch.isActive();
  }

  public setActive(newMain: BoolReturn): Boolable {
    this.activeSwitch.setActive(newMain);
    
    return this;
  }
  
  public and(...conditions: BoolReturn[]): Boolable {
    this.activeSwitch.and(...conditions);

    return this;
  }
  
  public or(...conditions: BoolReturn[]): Boolable {
    this.activeSwitch.or(...conditions);

    return this;
  }
  
  public nand(...conditions: BoolReturn[]): Boolable {
    this.activeSwitch.nand(...conditions);

    return this;
  }
  
  public nor(...conditions: BoolReturn[]): Boolable {
    this.activeSwitch.nor(...conditions);

    return this;
  }

  clk(useTurnStep: boolean): boolean {
    if (this.isDestroyed) return false;
    
    const nowActive = this.isActive();

    if (nowActive) {
      for (let i = 0; i < this.components.length; i++) {
        this.components[i].clk(this.ctx, nowActive, useTurnStep);
      }
    }

    return nowActive;
  }

  public destroy(): boolean {
    if (this.isDestroyed) return false;

    while (this.components.length > 0) {
      this.components.shift()!.onDestroy(this.ctx);
    }

    this.isDestroyed = true;

    return true;
  }

  public getComponents<T extends typeof OctaneComponent>(searchType: T): OctaneComponent[] {
    const ret: OctaneComponent[] = [];

    for (let i = 0; i < this.components.length; i++) {
      const comp = this.components[i];

      if (comp instanceof searchType) ret.push(comp);
    }

    return ret;
  }

  public getComponent<T extends typeof OctaneComponent>(searchType: T): Option<OctaneComponent> {
    const selection = this.getComponents(searchType);

    if (selection.length === 0) return none();

    return some(selection[0]);
  }
}

export abstract class OctaneComponent implements Boolable {
  public readonly isBoolable: true;
  private readonly activeSwitch: Boolable;
  private wasActive: boolean;
  private entity: OctaneEntity;
  private ranStart: boolean;
  private ranStartWithTurnStep: boolean;

  public constructor(entity: OctaneEntity, startsActive?: BoolReturn) {
    this.isBoolable = true;
    this.ranStart = false;
    this.ranStartWithTurnStep = false;
    this.entity = entity;
    
    if (startsActive === undefined) {
      this.activeSwitch = new BoolTree(true);
    }
    else if (isBoolable(startsActive)) {
      this.activeSwitch = startsActive as Boolable;
    }
    else {
      this.activeSwitch = new BoolTree(startsActive);
    }
    
    this.wasActive = false;

    const parentEntity = this.entity.get();

    if (parentEntity != null) {
      this.onAwake(parentEntity.ctx);
    }
  }

  public isActive(): boolean {
    if (this.entity.isNone()) return false;
    return this.entity.get()!.isActive() && this.isActiveSelf();
  }

  public isActiveSelf(): boolean {
    return this.activeSwitch.isActive();
  }

  public setActive(newMain: BoolReturn): Boolable {
    this.activeSwitch.setActive(newMain);
    
    return this;
  }
  
  public and(...conditions: BoolReturn[]): Boolable {
    this.activeSwitch.and(...conditions);

    return this;
  }
  
  public or(...conditions: BoolReturn[]): Boolable {
    this.activeSwitch.or(...conditions);

    return this;
  }
  
  public nand(...conditions: BoolReturn[]): Boolable {
    this.activeSwitch.nand(...conditions);

    return this;
  }
  
  public nor(...conditions: BoolReturn[]): Boolable {
    this.activeSwitch.nor(...conditions);

    return this;
  }

  clk(ctx: GameContext, entityActiveCache: boolean, useTurnStep: boolean): void {
    const nowActive = entityActiveCache && this.isActiveSelf();

    if (nowActive != this.wasActive) {
      if (nowActive) {
        this.onEnable(ctx, useTurnStep);
      }
      else {
        this.onDisable(ctx, useTurnStep);
      }
    }

    if (nowActive) {
      this.start(ctx, useTurnStep);
      this.onClk(ctx, useTurnStep);
    }

    this.wasActive = nowActive;
  }

  start(ctx: GameContext, useTurnStep: boolean): void {
    if (!this.ranStart) {
      this.ranStart = true;
      this.onStart(ctx, false);
    }

    if (useTurnStep && !this.ranStartWithTurnStep) {
      this.ranStartWithTurnStep = true;
      this.onStart(ctx, true);
    }
  }
  
  protected abstract onClk(ctx: GameContext, useTurnStep: boolean): void;
  protected abstract onAwake(ctx: GameContext): void;
  protected abstract onStart(ctx: GameContext, useTurnStep: boolean): void;
  protected abstract onEnable(ctx: GameContext, useTurnStep: boolean): void;
  protected abstract onDisable(ctx: GameContext, useTurnStep: boolean): void;
  abstract onDestroy(ctx: GameContext): void;
}
