import { isRootCollection } from "metabase/common/collections/utils";
import type { TreeItem } from "metabase/data-studio/common/types";
import type { SelectionState } from "metabase/ui";
import type { CollectionId, DatabaseId } from "metabase-types/api";

/**
 * Pure selection logic for Library bulk actions. The Library tree mixes three
 * sections (data / metrics / snippets); every content item is selectable —
 * tables, metrics, snippets, and sub-collections (moved as a unit) — but
 * library collections are typed per section, so a selection is constrained to a
 * single section: selecting in a different section replaces the prior
 * selection. Section-root rows (Data / Metrics / SQL snippets) act as a
 * "select all in this section" toggle. Kept React-free for direct unit tests.
 */

export type LibrarySection = "data" | "metrics" | "snippets";

export type SelectableModel = "table" | "metric" | "snippet" | "collection";

export type SelectedItem = {
  key: string;
  model: SelectableModel;
  section: LibrarySection;
  entityId: number;
  /** Source parent: `collection_id` for leaves, `parent_id` for collections. */
  sourceCollectionId: CollectionId | null;
  databaseId?: DatabaseId;
  canWrite: boolean;
};

// `TreeItem.data` under-types the real runtime payload (a full Collection /
// CollectionItem / NativeQuerySnippet); read the fields we need via these.
type CollectionLikeData = {
  id: number | string;
  type?: string | null;
  namespace?: string | null;
  is_library_root?: boolean;
  parent_id?: CollectionId | null;
  can_write?: boolean;
};

type LeafLikeData = {
  id: number;
  collection_id?: CollectionId | null;
  database_id?: DatabaseId;
  can_write?: boolean;
};

const asCollection = (item: TreeItem): CollectionLikeData =>
  item.data as unknown as CollectionLikeData;

const asLeaf = (item: TreeItem): LeafLikeData =>
  item.data as unknown as LeafLikeData;

const keyOf = (item: TreeItem): string => item.id;

export function getSelectedKeySet(selected: TreeItem[]): Set<string> {
  return new Set(selected.map(keyOf));
}

/** The library section a row belongs to, or null for non-section rows. */
export function getItemSection(item: TreeItem): LibrarySection | null {
  switch (item.model) {
    case "table":
      return "data";
    case "metric":
      return "metrics";
    case "snippet":
      return "snippets";
    case "collection": {
      const data = asCollection(item);
      if (data.namespace === "snippets") {
        return "snippets";
      }
      if (data.type === "library-metrics") {
        return "metrics";
      }
      if (data.type === "library-data") {
        return "data";
      }
      return null;
    }
    default:
      return null;
  }
}

/** A top-level section row (Data / Metrics / SQL snippets) — not itself movable. */
export function isSectionRoot(item: TreeItem): boolean {
  if (item.model !== "collection") {
    return false;
  }
  const data = asCollection(item);
  return (
    data.is_library_root === true ||
    isRootCollection({ id: data.id as CollectionId })
  );
}

/** Tables, metrics, snippets, and sub-collections are selectable. */
export function isSelectableItem(item: TreeItem): boolean {
  if (getItemSection(item) === null) {
    return false;
  }
  if (item.model === "collection") {
    return !isSectionRoot(item);
  }
  return true;
}

/** Direct selectable children of a section root (no recursion into folders). */
export function getSectionDirectSelectables(sectionRoot: TreeItem): TreeItem[] {
  return (sectionRoot.children ?? []).filter(isSelectableItem);
}

/** The section all selected items share (selection is single-section). */
export function getSelectionSection(
  selected: TreeItem[],
): LibrarySection | null {
  return selected.length > 0 ? getItemSection(selected[0]) : null;
}

function unionByKey(base: TreeItem[], additions: TreeItem[]): TreeItem[] {
  const keys = getSelectedKeySet(base);
  return [...base, ...additions.filter((item) => !keys.has(item.id))];
}

export function getRowSelectionState(
  item: TreeItem,
  selectedKeys: Set<string>,
): SelectionState {
  if (isSectionRoot(item)) {
    const selectables = getSectionDirectSelectables(item);
    if (selectables.length === 0) {
      return "none";
    }
    const count = selectables.filter((s) => selectedKeys.has(s.id)).length;
    if (count === 0) {
      return "none";
    }
    return count === selectables.length ? "all" : "some";
  }
  if (isSelectableItem(item)) {
    return selectedKeys.has(item.id) ? "all" : "none";
  }
  return "none";
}

/** Toggle a single selectable item, resetting selection when the section changes. */
export function toggleItem(selected: TreeItem[], item: TreeItem): TreeItem[] {
  const section = getItemSection(item);
  const current = getSelectionSection(selected);
  if (current !== null && current !== section) {
    return [item];
  }
  return getSelectedKeySet(selected).has(item.id)
    ? selected.filter((s) => s.id !== item.id)
    : [...selected, item];
}

/** Select/deselect all direct selectables of a section (switching section if needed). */
export function toggleSectionRoot(
  selected: TreeItem[],
  sectionRoot: TreeItem,
): TreeItem[] {
  const selectables = getSectionDirectSelectables(sectionRoot);
  if (selectables.length === 0) {
    return selected;
  }
  const section = getItemSection(sectionRoot);
  const current = getSelectionSection(selected);
  if (current !== null && current !== section) {
    return selectables;
  }
  const keys = getSelectedKeySet(selected);
  const allSelected = selectables.every((s) => keys.has(s.id));
  if (allSelected) {
    const sectionKeys = new Set(selectables.map(keyOf));
    return selected.filter((s) => !sectionKeys.has(s.id));
  }
  return unionByKey(selected, selectables);
}

/**
 * Shift-range select: add the selectable items in [from..to] that share the
 * clicked item's section, switching section if the current selection differs.
 */
export function selectItemRange(
  selected: TreeItem[],
  visibleItems: TreeItem[],
  fromIndex: number,
  toIndex: number,
): TreeItem[] {
  const anchor = visibleItems[toIndex];
  if (!anchor) {
    return selected;
  }
  const section = getItemSection(anchor);
  const start = Math.min(fromIndex, toIndex);
  const end = Math.max(fromIndex, toIndex);
  const rangeItems = visibleItems
    .slice(start, end + 1)
    .filter(isSelectableItem)
    .filter((item) => getItemSection(item) === section);
  const current = getSelectionSection(selected);
  if (current !== null && current !== section) {
    return rangeItems;
  }
  return unionByKey(selected, rangeItems);
}

/** True when the selection is non-empty and every item is a table. */
export function isAllTables(selected: TreeItem[]): boolean {
  return (
    selected.length > 0 && selected.every((item) => item.model === "table")
  );
}

/** Reduce selected tree items to the payload the Move/Unpublish actions need. */
export function deriveSelectedItems(selected: TreeItem[]): SelectedItem[] {
  return selected.map((item) => {
    const section = getItemSection(item) as LibrarySection;
    if (item.model === "collection") {
      const data = asCollection(item);
      return {
        key: item.id,
        model: "collection",
        section,
        entityId: data.id as number,
        sourceCollectionId: data.parent_id ?? null,
        canWrite: data.can_write ?? false,
      };
    }
    const data = asLeaf(item);
    return {
      key: item.id,
      model: item.model as SelectableModel,
      section,
      entityId: data.id,
      sourceCollectionId: data.collection_id ?? null,
      databaseId: data.database_id,
      canWrite: data.can_write ?? false,
    };
  });
}
