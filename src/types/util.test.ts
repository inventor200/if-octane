import { toSearchTerm } from "./util";

test('Strings convert to search terms', () => {
  expect(toSearchTerm("  Hello  world! ")).toBe("hello_world");
  expect(toSearchTerm("  _Hello  world!!!!! ")).toBe("_hello_world");
  expect(toSearchTerm("  !_! ")).toBe("");
});
