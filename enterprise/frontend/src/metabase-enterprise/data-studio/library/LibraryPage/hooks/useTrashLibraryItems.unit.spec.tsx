import fetchMock from "fetch-mock";

import { act, renderHookWithProviders } from "__support__/ui";

import type { SelectedItem } from "./library-bulk-selection.utils";
import { useTrashLibraryItems } from "./useTrashLibraryItems";

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

describe("useTrashLibraryItems", () => {
  it("archives each model with archived: true and reports affected collections", async () => {
    fetchMock.put("path:/api/card/2", { id: 2 }, { name: "card-put" });
    fetchMock.put(
      "path:/api/native-query-snippet/3",
      { id: 3 },
      { name: "snippet-put" },
    );
    fetchMock.put(
      "path:/api/collection/4",
      { id: 4 },
      { name: "collection-put" },
    );

    const { result } = renderHookWithProviders(
      () => useTrashLibraryItems(),
      {},
    );

    let outcome!: Awaited<ReturnType<ReturnType<typeof useTrashLibraryItems>>>;
    await act(async () => {
      outcome = await result.current([
        item("metric", 2, 11),
        item("snippet", 3, null),
        item("collection", 4, 10),
      ]);
    });

    expect(outcome.failedCount).toBe(0);
    expect(outcome.affectedCollectionIds.sort()).toEqual([10, 11]);

    expect(
      await fetchMock.callHistory.lastCall("card-put")?.request?.json(),
    ).toMatchObject({ archived: true });
    expect(
      await fetchMock.callHistory.lastCall("snippet-put")?.request?.json(),
    ).toMatchObject({ archived: true });
    expect(
      await fetchMock.callHistory.lastCall("collection-put")?.request?.json(),
    ).toMatchObject({ archived: true });
  });

  it("counts failures without throwing", async () => {
    fetchMock.put("path:/api/collection/1", { id: 1 }, { name: "ok" });
    fetchMock.put("path:/api/collection/2", 500, { name: "boom" });

    const { result } = renderHookWithProviders(
      () => useTrashLibraryItems(),
      {},
    );

    let outcome!: Awaited<ReturnType<ReturnType<typeof useTrashLibraryItems>>>;
    await act(async () => {
      outcome = await result.current([
        item("collection", 1, 10),
        item("collection", 2, 10),
      ]);
    });

    expect(outcome.failedCount).toBe(1);
  });
});
