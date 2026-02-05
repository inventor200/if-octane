import { createEntity, getEntity, createTestGlobal } from "./global-context";
import { toSearchTerm } from "./util";

test("Destroyed entities create none", () => {
  const ctx = createTestGlobal();
  
  const testEntity0Name = toSearchTerm("Test entity");
  const entity = createEntity(ctx, true, testEntity0Name).get()!;

  // Should be there
  const followup0 = getEntity(ctx, testEntity0Name);
  expect(followup0.isSome()).toBe(true);

  entity.destroy();

  const followup1 = getEntity(ctx, testEntity0Name);

  // Should be none, since getEntity filters for destruction
  expect(followup1.isNone()).toBe(true);
});
