import type { Row } from "@tanstack/react-table";
import { type MouseEvent, useCallback, useMemo, useRef, useState } from "react";

import type { TreeItem } from "metabase/data-studio/common/types";
import type { SelectionState } from "metabase/ui";

import {
  type LibrarySection,
  type SelectedItem,
  deriveSelectedItems,
  getRowSelectionState,
  getSelectedKeySet,
  getSelectionSection,
  isAllTables,
  isSectionRoot,
  isSelectableItem,
  selectItemRange,
  toggleItem,
  toggleSectionRoot,
} from "./library-bulk-selection.utils";

export type UseLibraryBulkSelectionResult = {
  selectedItems: SelectedItem[];
  selectionSection: LibrarySection | null;
  isAllTables: boolean;
  getSelectionState: (row: Row<TreeItem>) => SelectionState;
  onCheckboxClick: (
    row: Row<TreeItem>,
    index: number,
    event: MouseEvent,
  ) => void;
  clear: () => void;
};

export function useLibraryBulkSelection(
  rows: Row<TreeItem>[],
): UseLibraryBulkSelectionResult {
  const [selected, setSelected] = useState<TreeItem[]>([]);
  const lastSelectedIndexRef = useRef<number | null>(null);

  const visibleItems = useMemo(() => rows.map((row) => row.original), [rows]);
  const visibleItemsRef = useRef(visibleItems);
  visibleItemsRef.current = visibleItems;

  const selectedKeys = useMemo(() => getSelectedKeySet(selected), [selected]);

  const getSelectionState = useCallback(
    (row: Row<TreeItem>): SelectionState =>
      getRowSelectionState(row.original, selectedKeys),
    [selectedKeys],
  );

  const onCheckboxClick = useCallback(
    (row: Row<TreeItem>, index: number, event: MouseEvent) => {
      const item = row.original;

      if (isSectionRoot(item)) {
        setSelected((prev) => toggleSectionRoot(prev, item));
        lastSelectedIndexRef.current = null;
        return;
      }

      if (!isSelectableItem(item)) {
        return;
      }

      const lastIndex = lastSelectedIndexRef.current;
      if (event.shiftKey && lastIndex != null) {
        setSelected((prev) =>
          selectItemRange(prev, visibleItemsRef.current, lastIndex, index),
        );
      } else {
        setSelected((prev) => toggleItem(prev, item));
      }
      lastSelectedIndexRef.current = index;
    },
    [],
  );

  const clear = useCallback(() => {
    setSelected([]);
    lastSelectedIndexRef.current = null;
  }, []);

  const selectedItems = useMemo(
    () => deriveSelectedItems(selected),
    [selected],
  );
  const selectionSection = useMemo(
    () => getSelectionSection(selected),
    [selected],
  );
  const allTables = useMemo(() => isAllTables(selected), [selected]);

  return {
    selectedItems,
    selectionSection,
    isAllTables: allTables,
    getSelectionState,
    onCheckboxClick,
    clear,
  };
}
