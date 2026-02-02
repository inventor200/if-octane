import { BoolTree } from "./bool-tree";
import { isBoolable } from "./boolable";

test('Integers are not Boolables', () => {
  expect(isBoolable(5)).toBe(false);
});

test('Booleans are actually not Boolables', () => {
  expect(isBoolable(true)).toBe(false);
});

test('Functions are not Boolables', () => {
  expect(isBoolable(() => true)).toBe(false);
});

test('Not just any objects are not Boolables', () => {
  expect(isBoolable({ myProp: "myValue" })).toBe(false);
});

test('Impostors are not Boolables', () => {
  expect(isBoolable({ myProp: "myValue", isBoolable: true })).toBe(false);
});

test('Arrays are not Boolables', () => {
  expect(isBoolable([1, 2, 3])).toBe(false);
});

test('BoolTrees are Boolables', () => {
  expect(isBoolable(new BoolTree(false))).toBe(true);
});
