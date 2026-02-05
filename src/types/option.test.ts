import { some } from "./option";
import { createEntity, createTestGlobal } from "./global-context";

test('Valid options stay valid', () => {
  const val = some(5);

  expect(val.isSome()).toBe(true);
});

test('Destroyed options become none', () => {
  const testCtx = createTestGlobal();

  const entity = createEntity(testCtx).get()!;
  const val = some(entity);

  expect(val.isSome()).toBe(true);

  entity.destroy();

  expect(val.isSome()).toBe(false);
});
