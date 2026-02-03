import { some } from "./option";
import { OctaneEntity } from "./ecs";

test('Valid options stay valid', () => {
  const val = some(5);

  expect(val.isSome()).toBe(true);
});

test('Destroyed options become none', () => {
  const entity = new OctaneEntity();
  const val = some(entity);

  expect(val.isSome()).toBe(true);

  entity.destroy();

  expect(val.isSome()).toBe(false);
});
