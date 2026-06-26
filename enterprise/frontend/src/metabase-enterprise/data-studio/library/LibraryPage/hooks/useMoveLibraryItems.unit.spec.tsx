import fetchMock from "fetch-mock";

import { act, renderHookWithProviders } from "__support__/ui";

import type { SelectedItem } from "./library-bulk-selection.utils";
import { useMoveLibraryItems } from "./useMoveLibraryItems";

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

describe("useMoveLibraryItems", () => {
  it("moves each model with the correct mutation and payload", async () => {
    fetchMock.put("path:/api/table/1", { id: 1 }, { name: "table-put" });
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

    const { result } = renderHookWithProviders(() => useMoveLibraryItems(), {});

    let outcome!: Awaited<ReturnType<ReturnType<typeof useMoveLibraryItems>>>;
    await act(async () => {
      outcome = await result.current(
        [
          item("table", 1, 10),
          item("metric", 2, 11),
          item("snippet", 3, null),
          item("collection", 4, 10),
        ],
        99,
      );
    });

    expect(outcome.failedCount).toBe(0);
    expect(outcome.affectedCollectionIds.sort()).toEqual([10, 11, 99]);

    expect(
      await fetchMock.callHistory.lastCall("table-put")?.request?.json(),
    ).toMatchObject({ collection_id: 99 });
    expect(
      await fetchMock.callHistory.lastCall("card-put")?.request?.json(),
    ).toMatchObject({ collection_id: 99 });
    expect(
      await fetchMock.callHistory.lastCall("snippet-put")?.request?.json(),
    ).toMatchObject({ collection_id: 99 });
    expect(
      await fetchMock.callHistory.lastCall("collection-put")?.request?.json(),
    ).toMatchObject({ parent_id: 99 });
  });

  it("counts failures without throwing", async () => {
    fetchMock.put("path:/api/table/1", { id: 1 }, { name: "ok" });
    fetchMock.put("path:/api/table/2", 500, { name: "boom" });

    const { result } = renderHookWithProviders(() => useMoveLibraryItems(), {});

    let outcome!: Awaited<ReturnType<ReturnType<typeof useMoveLibraryItems>>>;
    await act(async () => {
      outcome = await result.current(
        [item("table", 1, 10), item("table", 2, 10)],
        99,
      );
    });

    expect(outcome.failedCount).toBe(1);
  });
});
