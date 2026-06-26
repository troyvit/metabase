import type { SelectedItem } from "./library-bulk-selection.utils";
import { getAffectedCollectionIds } from "./library-item-updates";

function item(
  model: SelectedItem["model"],
  entityId: number,
  sourceCollectionId: number | null,
): SelectedItem {
  return {
    key: `${model}:${entityId}`,
    model,
    section:
      model === "metric"
        ? "metrics"
        : model === "snippet"
          ? "snippets"
          : "data",
    entityId,
    sourceCollectionId,
    canWrite: true,
  };
}

describe("getAffectedCollectionIds", () => {
  it("unions sources and destination, de-duplicated and excluding null", () => {
    expect(
      getAffectedCollectionIds(
        [item("table", 1, 10), item("metric", 2, 11), item("snippet", 3, null)],
        99,
      ).sort(),
    ).toEqual([10, 11, 99]);
  });
});
