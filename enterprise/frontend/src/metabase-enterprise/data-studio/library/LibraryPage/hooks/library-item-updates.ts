import { match } from "ts-pattern";

import type { ArchivableItem } from "metabase/archive/hooks";
import type { MovableItem } from "metabase/common/hooks";
import type { CollectionId } from "metabase-types/api";

import type { SelectedItem } from "./library-bulk-selection.utils";

export type LibraryItemUpdateResult = {
  failedCount: number;
  affectedCollectionIds: CollectionId[];
};

// Snippet-section folders map to `snippet-collection`; all others to `collection`.
export function selectedItemToMovable(item: SelectedItem): MovableItem {
  const { entityId: id } = item;
  return match(item)
    .with({ model: "table" }, () => ({ model: "table", id }) as const)
    .with({ model: "metric" }, () => ({ model: "metric", id }) as const)
    .with({ model: "snippet" }, () => ({ model: "snippet", id }) as const)
    .with(
      { model: "collection", section: "snippets" },
      () => ({ model: "snippet-collection", id }) as const,
    )
    .with({ model: "collection" }, () => ({ model: "collection", id }) as const)
    .exhaustive();
}

export function selectedItemToArchivable(item: SelectedItem): ArchivableItem {
  const { entityId: id, canWrite } = item;
  return match(item)
    .with(
      { model: "metric" },
      () => ({ model: "metric", id, can_write: canWrite }) as const,
    )
    .with(
      { model: "snippet" },
      () => ({ model: "snippet", id, can_write: canWrite }) as const,
    )
    .with(
      { model: "collection", section: "snippets" },
      () => ({ model: "snippet-collection", id, can_write: canWrite }) as const,
    )
    .with(
      { model: "collection" },
      () => ({ model: "collection", id, can_write: canWrite }) as const,
    )
    .with({ model: "table" }, () => {
      throw new Error("Tables are unpublished, not moved to the trash");
    })
    .exhaustive();
}

// Returns the touched collections so the caller can refresh subcollections held
// in local state; RTK tags already refresh the subscribed section-root lists.
export async function runLibraryItemUpdates(
  items: SelectedItem[],
  applyToItem: (item: SelectedItem) => Promise<unknown>,
  destinationId: CollectionId | null,
): Promise<LibraryItemUpdateResult> {
  const results = await Promise.allSettled(items.map(applyToItem));
  return {
    failedCount: results.filter((r) => r.status === "rejected").length,
    affectedCollectionIds: getAffectedCollectionIds(items, destinationId),
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
