import { createEntity, getEntity } from "./global-context";
import { toSearchTerm } from "./util";

test("Destroyed entities create none", () => {
  // All test entities should have unique names,
  // depending on how testing handles threads
  const testEntity0Name = toSearchTerm(
    "Destroyed entities create none entity name"
  );
  const entity = createEntity(true, testEntity0Name).get()!;

  // Should be there
  const followup0 = getEntity(testEntity0Name);
  expect(followup0.isSome()).toBe(true);

  entity.destroy();

  const followup1 = getEntity(testEntity0Name);

  // Should be none, since getEntity filters for destruction
  expect(followup1.isNone()).toBe(true);
});
