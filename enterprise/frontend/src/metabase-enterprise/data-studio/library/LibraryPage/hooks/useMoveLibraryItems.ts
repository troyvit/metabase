import { useCallback } from "react";

import {
  collectionApi,
  useUpdateCardMutation,
  useUpdateCollectionMutation,
  useUpdateSnippetMutation,
  useUpdateTableMutation,
} from "metabase/api";
import { useDispatch } from "metabase/redux";
import type { CollectionId, RegularCollectionId } from "metabase-types/api";

import type { SelectedItem } from "./library-bulk-selection.utils";

export type MoveLibraryItemsResult = {
  failedCount: number;
  affectedCollectionIds: CollectionId[];
};

/**
 * Move a heterogeneous set of selected Library items to one destination
 * collection, dispatching the right mutation per model (table → collection_id,
 * metric/card → collection_id, snippet → collection_id, collection → parent_id).
 * Moves run concurrently; failures are counted, not thrown. Invalidates the
 * affected collections' item lists so the top-level tree refetches (lazy-loaded
 * subtrees are refreshed by the caller via the section refresh fns).
 */
export function useMoveLibraryItems() {
  const [updateTable] = useUpdateTableMutation();
  const [updateCard] = useUpdateCardMutation();
  const [updateSnippet] = useUpdateSnippetMutation();
  const [updateCollection] = useUpdateCollectionMutation();
  const dispatch = useDispatch();

  return useCallback(
    async (
      items: SelectedItem[],
      destinationId: RegularCollectionId | null,
    ): Promise<MoveLibraryItemsResult> => {
      const results = await Promise.allSettled(
        items.map((item) => {
          switch (item.model) {
            case "table":
              return updateTable({
                id: item.entityId,
                collection_id: destinationId,
              }).unwrap();
            case "metric":
              return updateCard({
                id: item.entityId,
                collection_id: destinationId,
              }).unwrap();
            case "snippet":
              return updateSnippet({
                id: item.entityId,
                collection_id: destinationId,
              }).unwrap();
            case "collection":
              return updateCollection({
                id: item.entityId,
                parent_id: destinationId,
              }).unwrap();
          }
        }),
      );

      const affectedCollectionIds = getAffectedCollectionIds(
        items,
        destinationId,
      );
      dispatch(
        collectionApi.util.invalidateTags(
          affectedCollectionIds.map((id) => ({
            type: "collection" as const,
            id: `${id}-items`,
          })),
        ),
      );

      return {
        failedCount: results.filter((r) => r.status === "rejected").length,
        affectedCollectionIds,
      };
    },
    [updateTable, updateCard, updateSnippet, updateCollection, dispatch],
  );
}

/** Source collections of the moved items plus the destination, de-duplicated. */
export function getAffectedCollectionIds(
  items: SelectedItem[],
  destinationId: CollectionId | null,
): CollectionId[] {
  const ids = new Set<CollectionId>();
  if (destinationId != null) {
    ids.add(destinationId);
  }
  for (const item of items) {
    if (item.sourceCollectionId != null) {
      ids.add(item.sourceCollectionId);
    }
  }
  return [...ids];
}
