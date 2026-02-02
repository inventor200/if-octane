import { Boolable, BoolReturn, evaluateBoolReturn, isBoolable } from "./boolable";

export class BoolTree implements Boolable {
  public mainCondition: BoolReturn;
  public andConditions: Boolable[];
  public orConditions: Boolable[];
  public nandConditions: Boolable[];
  public norConditions: Boolable[];
  public readonly isBoolable: true;
  
  constructor(mainCondition?: BoolReturn) {
    this.isBoolable = true;
    this.andConditions = [];
    this.orConditions = [];
    this.nandConditions = [];
    this.norConditions = [];
    
    if (mainCondition !== undefined) {
      this.mainCondition = mainCondition;
    }
    else {
      this.mainCondition = true;
    }
  }

  setActive(newMain: BoolReturn): Boolable {
    this.mainCondition = newMain;

    return this;
  }

  private incorporate(list: Boolable[], conditions: BoolReturn[]): Boolable {
    for (let i = 0; i < conditions.length; i++) {
      const condition = conditions[i];
      if (isBoolable(condition)) {
        list.push(condition as Boolable);
      }
      else {
        list.push(new BoolTree(condition));
      }
    }

    return this;
  }

  and(...conditions: BoolReturn[]): Boolable {
    return this.incorporate(this.andConditions, conditions);
  }

  or(...conditions: BoolReturn[]): Boolable {
    return this.incorporate(this.orConditions, conditions);
  }

  nand(...conditions: BoolReturn[]): Boolable {
    return this.incorporate(this.nandConditions, conditions);
  }

  nor(...conditions: BoolReturn[]): Boolable {
    return this.incorporate(this.norConditions, conditions);
  }

  // main && and && or && !(nand || nor)
  isActive(): boolean {
    const mainEvaluation = evaluateBoolReturn(this.mainCondition);
    if (!mainEvaluation) return false;

    const evalAbstract = (emptyVal: boolean, list: Boolable[], checkVal: boolean): boolean => {
      if (list.length === 0) return emptyVal;

      for (let i = 0; i < list.length; i++) {
        const listCondition = list[i].isActive();

        if (listCondition === checkVal) return checkVal;
      }

      return !checkVal;
    }
    
    const evalAnd = (emptyVal: boolean, list: Boolable[]): boolean => {
      return evalAbstract(emptyVal, list, false);
    }
    
    const evalOr = (emptyVal: boolean, list: Boolable[]): boolean => {
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
  shallowClone(): BoolTree {
    const clone = new BoolTree(this.mainCondition);

    const shallowCopyTo = (src: Boolable[], dst: Boolable[]): void => {
      for (let i = 0; i < src.length; i++) {
        dst.push(src[i]);
      }
    }

    shallowCopyTo(this.andConditions, clone.andConditions);
    shallowCopyTo(this.orConditions, clone.orConditions);
    shallowCopyTo(this.nandConditions, clone.nandConditions);
    shallowCopyTo(this.norConditions, clone.norConditions);

    return clone;
  }

  // Everything is cloned
  clone(): Boolable {
    const clone = new BoolTree(this.mainCondition);

    const deepCopyTo = (src: Boolable[], dst: Boolable[]): void => {
      for (let i = 0; i < src.length; i++) {
        dst.push(src[i].clone());
      }
    }

    deepCopyTo(this.andConditions, clone.andConditions);
    deepCopyTo(this.orConditions, clone.orConditions);
    deepCopyTo(this.nandConditions, clone.nandConditions);
    deepCopyTo(this.norConditions, clone.norConditions);

    return clone;
  }
}
