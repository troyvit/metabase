import type { Row } from "@tanstack/react-table";
import type { MouseEvent } from "react";

import { act, renderHookWithProviders } from "__support__/ui";
import type { TreeItem } from "metabase/data-studio/common/types";
import type { CollectionId, CollectionType } from "metabase-types/api";
import {
  createMockCollection,
  createMockCollectionItem,
} from "metabase-types/api/mocks";

import type { LibrarySection } from "./library-bulk-selection.utils";
import { useLibraryBulkSelection } from "./useLibraryBulkSelection";

const SECTION_TYPE: Record<LibrarySection, CollectionType | null> = {
  data: "library-data",
  metrics: "library-metrics",
  snippets: null,
};

function tableItem(
  id: number,
  opts: { collectionId?: number | null; databaseId?: number } = {},
): TreeItem {
  return {
    id: `table:${id}`,
    name: `Table ${id}`,
    icon: "table",
    model: "table",
    data: createMockCollectionItem({
      id,
      model: "table",
      database_id: opts.databaseId ?? 1,
      collection_id: opts.collectionId ?? null,
      can_write: true,
    }),
  };
}

function metricItem(id: number): TreeItem {
  return {
    id: `metric:${id}`,
    name: `Metric ${id}`,
    icon: "metric",
    model: "metric",
    data: createMockCollectionItem({ id, model: "metric", can_write: true }),
  };
}

function subCollection(id: number, section: LibrarySection): TreeItem {
  return {
    id: `collection:${id}`,
    name: `Collection ${id}`,
    icon: "folder",
    model: "collection",
    data: {
      ...createMockCollection({
        id,
        type: SECTION_TYPE[section],
        namespace: section === "snippets" ? "snippets" : null,
        is_library_root: false,
        can_write: true,
      }),
      model: "collection",
    },
  };
}

function sectionRoot(section: LibrarySection, children: TreeItem[]): TreeItem {
  const id: CollectionId = section === "snippets" ? "root" : 100;
  return {
    id: `collection:${id}`,
    name: section,
    icon: "folder",
    model: "collection",
    data: {
      ...createMockCollection({
        id,
        type: SECTION_TYPE[section],
        namespace: section === "snippets" ? "snippets" : null,
        is_library_root: section !== "snippets",
      }),
      model: "collection",
    },
    children,
  };
}

const asRow = (item: TreeItem): Row<TreeItem> =>
  ({ original: item }) as unknown as Row<TreeItem>;

const clickEvent = (shiftKey = false) => {
  const preventDefault = jest.fn();
  return {
    event: { preventDefault, shiftKey } as unknown as MouseEvent,
    preventDefault,
  };
};

const setup = (items: TreeItem[]) => {
  const rows = items.map(asRow);
  return renderHookWithProviders(() => useLibraryBulkSelection(rows), {});
};

const keys = (
  items: ReturnType<typeof useLibraryBulkSelection>["selectedItems"],
) => items.map((item) => item.key);

describe("useLibraryBulkSelection", () => {
  it("selects an item without calling preventDefault (keeps the controlled checkbox in sync)", () => {
    const t1 = tableItem(1);
    const { result } = setup([t1]);

    const { event, preventDefault } = clickEvent();
    act(() => result.current.onCheckboxClick(asRow(t1), 0, event));

    expect(preventDefault).not.toHaveBeenCalled();
    expect(keys(result.current.selectedItems)).toEqual(["table:1"]);
    expect(result.current.selectionSection).toBe("data");
  });

  it("toggles an item off when clicked again", () => {
    const t1 = tableItem(1);
    const { result } = setup([t1]);

    act(() => result.current.onCheckboxClick(asRow(t1), 0, clickEvent().event));
    act(() => result.current.onCheckboxClick(asRow(t1), 0, clickEvent().event));

    expect(result.current.selectedItems).toEqual([]);
  });

  it("mixes tables and sub-collections in the same section", () => {
    const t1 = tableItem(1);
    const c1 = subCollection(5, "data");
    const { result } = setup([t1, c1]);

    act(() => result.current.onCheckboxClick(asRow(t1), 0, clickEvent().event));
    act(() => result.current.onCheckboxClick(asRow(c1), 1, clickEvent().event));

    expect(keys(result.current.selectedItems)).toEqual([
      "table:1",
      "collection:5",
    ]);
    expect(result.current.isAllTables).toBe(false);
  });

  it("replaces the selection when switching sections", () => {
    const t1 = tableItem(1);
    const m1 = metricItem(9);
    const { result } = setup([t1, m1]);

    act(() => result.current.onCheckboxClick(asRow(t1), 0, clickEvent().event));
    act(() => result.current.onCheckboxClick(asRow(m1), 1, clickEvent().event));

    expect(keys(result.current.selectedItems)).toEqual(["metric:9"]);
    expect(result.current.selectionSection).toBe("metrics");
  });

  it("shift-clicking selects the range of items", () => {
    const t1 = tableItem(1);
    const c1 = subCollection(5, "data");
    const t2 = tableItem(2);
    const { result } = setup([t1, c1, t2]);

    act(() => result.current.onCheckboxClick(asRow(t1), 0, clickEvent().event));
    act(() =>
      result.current.onCheckboxClick(asRow(t2), 2, clickEvent(true).event),
    );

    expect(keys(result.current.selectedItems)).toEqual([
      "table:1",
      "collection:5",
      "table:2",
    ]);
  });

  it("section-root click selects every item in that section", () => {
    const t1 = tableItem(1);
    const t2 = tableItem(2);
    const root = sectionRoot("data", [t1, t2]);
    const { result } = setup([root, t1, t2]);

    act(() =>
      result.current.onCheckboxClick(asRow(root), 0, clickEvent().event),
    );

    expect(keys(result.current.selectedItems).sort()).toEqual([
      "table:1",
      "table:2",
    ]);
    expect(result.current.isAllTables).toBe(true);
  });

  it("reports isAllTables only for an all-table selection", () => {
    const t1 = tableItem(1);
    const c1 = subCollection(5, "data");
    const { result } = setup([t1, c1]);

    act(() => result.current.onCheckboxClick(asRow(t1), 0, clickEvent().event));
    expect(result.current.isAllTables).toBe(true);

    act(() => result.current.onCheckboxClick(asRow(c1), 1, clickEvent().event));
    expect(result.current.isAllTables).toBe(false);
  });

  it("stays consistent when the checkbox holds a stale handler (row not re-rendered)", () => {
    const t1 = tableItem(1);
    const t2 = tableItem(2);
    const { result } = setup([t1, t2]);

    const onClick = result.current.onCheckboxClick;
    act(() => onClick(asRow(t1), 0, clickEvent().event));
    act(() => onClick(asRow(t2), 1, clickEvent().event));

    expect(keys(result.current.selectedItems).sort()).toEqual([
      "table:1",
      "table:2",
    ]);
  });

  it("gives getSelectionState a fresh identity when selection changes", () => {
    const t1 = tableItem(1);
    const { result } = setup([t1]);

    const before = result.current.getSelectionState;
    act(() => result.current.onCheckboxClick(asRow(t1), 0, clickEvent().event));
    const after = result.current.getSelectionState;

    expect(after).not.toBe(before);
  });

  it("reports row state and clears", () => {
    const t1 = tableItem(1);
    const t2 = tableItem(2);
    const root = sectionRoot("data", [t1, t2]);
    const { result } = setup([root, t1, t2]);

    act(() => result.current.onCheckboxClick(asRow(t1), 1, clickEvent().event));
    expect(result.current.getSelectionState(asRow(t1))).toBe("all");
    expect(result.current.getSelectionState(asRow(t2))).toBe("none");
    expect(result.current.getSelectionState(asRow(root))).toBe("some");

    act(() => result.current.clear());
    expect(result.current.selectedItems).toEqual([]);
    expect(result.current.selectionSection).toBeNull();
  });
});
