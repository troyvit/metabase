import { collectionApi } from "metabase/api";
import type { Dispatch } from "metabase/redux/store";
import type { CollectionId } from "metabase-types/api";

import type { SelectedItem } from "./library-bulk-selection.utils";

export type LibraryItemUpdateResult = {
  failedCount: number;
  affectedCollectionIds: CollectionId[];
};

// Applies `applyToItem` to each selected item concurrently, counting (not
// throwing) failures, then refreshes the affected collections' item lists.
export async function runLibraryItemUpdates(
  items: SelectedItem[],
  applyToItem: (item: SelectedItem) => Promise<unknown>,
  destinationId: CollectionId | null,
  dispatch: Dispatch,
): Promise<LibraryItemUpdateResult> {
  const results = await Promise.allSettled(items.map(applyToItem));
  const affectedCollectionIds = getAffectedCollectionIds(items, destinationId);
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
}

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
