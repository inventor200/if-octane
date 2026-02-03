import { Boolable, BoolReturn, evaluateBoolReturn, isBoolable } from "./boolable";
import { Option, some } from "./option";

export class BoolTree implements Boolable {
  private mainCondition: Option<BoolReturn>;
  public andConditions: Option<Boolable>[];
  public orConditions: Option<Boolable>[];
  public nandConditions: Option<Boolable>[];
  public norConditions: Option<Boolable>[];
  public readonly isBoolable: true;
  
  public constructor(mainCondition?: (BoolReturn | Option<BoolReturn>)) {
    this.isBoolable = true;
    this.andConditions = [];
    this.orConditions = [];
    this.nandConditions = [];
    this.norConditions = [];
    
    if (mainCondition !== undefined) {
      if (mainCondition instanceof Option) {
        this.mainCondition = mainCondition;
      }
      else {
        this.mainCondition = some(mainCondition);
      }
    }
    else {
      this.mainCondition = some(true);
    }
  }

  public setActive(newMain: BoolReturn): Boolable {
    this.mainCondition = some(newMain);

    return this;
  }

  private incorporate(list: Option<Boolable>[], conditions: BoolReturn[]): Boolable {
    for (let i = 0; i < conditions.length; i++) {
      const condition = conditions[i];
      if (isBoolable(condition)) {
        list.push(some(condition as Boolable));
      }
      else {
        list.push(some(new BoolTree(some(condition))));
      }
    }

    return this;
  }

  public and(...conditions: BoolReturn[]): Boolable {
    return this.incorporate(this.andConditions, conditions);
  }

  public or(...conditions: BoolReturn[]): Boolable {
    return this.incorporate(this.orConditions, conditions);
  }

  public nand(...conditions: BoolReturn[]): Boolable {
    return this.incorporate(this.nandConditions, conditions);
  }

  public nor(...conditions: BoolReturn[]): Boolable {
    return this.incorporate(this.norConditions, conditions);
  }

  // main && and && or && !(nand || nor)
  public isActive(): boolean {
    if (this.mainCondition.isNone()) return false;
    const mainEvaluation = evaluateBoolReturn(this.mainCondition.get()!);
    if (!mainEvaluation) return false;

    const evalAbstract = (emptyVal: boolean, list: Option<Boolable>[], checkVal: boolean): boolean => {
      if (list.length === 0) return emptyVal;

      for (let i = 0; i < list.length; i++) {
        const listItem = list[i];

        const isNone = listItem.isNone();
        const listCondition = isNone ? emptyVal : listItem.get()!.isActive();

        if (isNone) { // Drop the items for optimization
          list.splice(i, 1);
          i--;
          continue;
        }

        if (listCondition === checkVal) return checkVal;
      }

      return !checkVal;
    }
    
    const evalAnd = (emptyVal: boolean, list: Option<Boolable>[]): boolean => {
      return evalAbstract(emptyVal, list, false);
    }
    
    const evalOr = (emptyVal: boolean, list: Option<Boolable>[]): boolean => {
      return evalAbstract(emptyVal, list, true);
    }

    const andEvaluation = evalAnd(true, this.andConditions);
    if (!andEvaluation) return false;

    const orEvaluation = evalOr(true, this.orConditions);
    if (!orEvaluation) return false;

    const nandEvaluation = evalAnd(false, this.nandConditions);
    if (nandEvaluation) return false;

    const norEvaluation = evalOr(false, this.norConditions);
    if (norEvaluation) return false;

    return true;
  }

  // The lists are cloned, but the items are all references
  public shallowClone(): BoolTree {
    const clone = new BoolTree(this.mainCondition);

    const shallowCopyTo = (src: Option<Boolable>[], dst: Option<Boolable>[]): void => {
      for (let i = 0; i < src.length; i++) {
        const item = src[i];

        if (item.isNone()) { // Drop the items for optimization
          src.splice(i, 1);
          i--;
          continue
        }
        
        dst.push(item);
      }
    }

    shallowCopyTo(this.andConditions, clone.andConditions);
    shallowCopyTo(this.orConditions, clone.orConditions);
    shallowCopyTo(this.nandConditions, clone.nandConditions);
    shallowCopyTo(this.norConditions, clone.norConditions);

    return clone;
  }

  // Everything is cloned
  public clone(): BoolTree {
    const clone = new BoolTree(this.mainCondition);

    const deepCopyTo = (src: Option<Boolable>[], dst: Option<Boolable>[]): void => {
      for (let i = 0; i < src.length; i++) {
        const item = src[i];

        if (item.isNone()) { // Drop the items for optimization
          src.splice(i, 1);
          i--;
          continue
        }

        const confirmed = item.get()!;

        if (confirmed instanceof BoolTree) {
          dst.push(some((confirmed as BoolTree).clone()))
        }
        else {
          dst.push(some(confirmed));
        }
      }
    }

    deepCopyTo(this.andConditions, clone.andConditions);
    deepCopyTo(this.orConditions, clone.orConditions);
    deepCopyTo(this.nandConditions, clone.nandConditions);
    deepCopyTo(this.norConditions, clone.norConditions);

    return clone;
  }
}
