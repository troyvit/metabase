import { useCallback } from "react";

import {
  useUpdateCardMutation,
  useUpdateCollectionMutation,
  useUpdateSnippetMutation,
} from "metabase/api";
import { useDispatch } from "metabase/redux";

import type { SelectedItem } from "./library-bulk-selection.utils";
import { runLibraryItemUpdates } from "./library-item-updates";

export function useTrashLibraryItems() {
  const [updateCard] = useUpdateCardMutation();
  const [updateSnippet] = useUpdateSnippetMutation();
  const [updateCollection] = useUpdateCollectionMutation();
  const dispatch = useDispatch();

  return useCallback(
    (items: SelectedItem[]) =>
      runLibraryItemUpdates(
        items,
        (item) => {
          switch (item.model) {
            case "metric":
              return updateCard({ id: item.entityId, archived: true }).unwrap();
            case "snippet":
              return updateSnippet({
                id: item.entityId,
                archived: true,
              }).unwrap();
            case "collection":
              return updateCollection({
                id: item.entityId,
                archived: true,
              }).unwrap();
            case "table":
              return Promise.resolve();
          }
        },
        null,
        dispatch,
      ),
    [updateCard, updateSnippet, updateCollection, dispatch],
  );
}
