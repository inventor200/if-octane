import { BoolTree } from "./bool-tree";

test('BoolTrees handle literal mains', () => {
  const myTrueTree = new BoolTree(true);
  expect(myTrueTree.isActive()).toBe(true);
  
  const myFalseTree = new BoolTree(false);
  expect(myFalseTree.isActive()).toBe(false);
});

test('BoolTrees handle function mains', () => {
  const myTrueTree = new BoolTree(() => true);
  expect(myTrueTree.isActive()).toBe(true);
  
  const myFalseTree = new BoolTree(() => false);
  expect(myFalseTree.isActive()).toBe(false);
});

test('BoolTrees handle BoolTree mains', () => {
  const myTrueTree = new BoolTree(new BoolTree(true));
  expect(myTrueTree.isActive()).toBe(true);
  
  const myFalseTree = new BoolTree(new BoolTree(false));
  expect(myFalseTree.isActive()).toBe(false);
});

test('BoolTrees handle uniform AND', () => {
  const myTree = new BoolTree(true)
    .and(
      true,
      () => true,
      new BoolTree(true)
    );

  expect(myTree.isActive()).toBe(true);
});

test('BoolTrees handle non-uniform AND', () => {
  const myTree = new BoolTree(true)
    .and(
      true,
      () => false,
      new BoolTree(true)
    );

  expect(myTree.isActive()).toBe(false);
});

test('BoolTree main spoils AND', () => {
  const myTree = new BoolTree(false)
    .and(
      true,
      () => true,
      new BoolTree(true)
    );

  expect(myTree.isActive()).toBe(false);
});

test('BoolTrees handle uniform OR', () => {
  const myTree = new BoolTree(true)
    .or(
      true,
      () => true,
      new BoolTree(true)
    );

  expect(myTree.isActive()).toBe(true);
});

test('BoolTrees handle non-uniform OR', () => {
  const myTree = new BoolTree(true)
    .or(
      true,
      () => false,
      new BoolTree(true)
    );

  expect(myTree.isActive()).toBe(true);
});

test('BoolTrees handle empty OR', () => {
  const myTree = new BoolTree(true)
    .or(
      false,
      () => false,
      new BoolTree(false)
    );

  expect(myTree.isActive()).toBe(false);
});

test('BoolTree main spoils OR', () => {
  const myTree = new BoolTree(false)
    .or(
      true,
      () => true,
      new BoolTree(true)
    );

  expect(myTree.isActive()).toBe(false);
});

test('BoolTree needs strict NAND', () => {
  const myTree = new BoolTree(true)
    .nand(
      true,
      () => false,
      new BoolTree(true)
    );

  expect(myTree.isActive()).toBe(true);
});

test('BoolTree spoiled by NAND', () => {
  const myTree = new BoolTree(true)
    .nand(
      true,
      () => true,
      new BoolTree(true)
    );

  expect(myTree.isActive()).toBe(false);
});

test('BoolTree main pre-spoils NAND', () => {
  const myTree = new BoolTree(false)
    .nand(
      true,
      () => false,
      new BoolTree(true)
    );

  expect(myTree.isActive()).toBe(false);
});

test('BoolTree needs any NOR', () => {
  const myTree = new BoolTree(true)
    .nor(
      false,
      () => true,
      new BoolTree(false)
    );

  expect(myTree.isActive()).toBe(false);
});

test('BoolTree passes empty NOR', () => {
  const myTree = new BoolTree(true)
    .nor(
      false,
      () => false,
      new BoolTree(false)
    );

  expect(myTree.isActive()).toBe(true);
});

test('BoolTree main thwarts empty NOR', () => {
  const myTree = new BoolTree(false)
    .nor(
      false,
      () => false,
      new BoolTree(false)
    );

  expect(myTree.isActive()).toBe(false);
});
