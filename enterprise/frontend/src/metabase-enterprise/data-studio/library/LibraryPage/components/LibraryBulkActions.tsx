import { useCallback, useMemo, useState } from "react";
import { msgid, ngettext, t } from "ttag";

import {
  BulkActionBar,
  BulkActionButton,
} from "metabase/common/components/BulkActionBar";
import {
  CollectionPickerModal,
  type OmniPickerItem,
} from "metabase/common/components/Pickers";
import { useMetadataToasts } from "metabase/metadata/hooks";
import type { CollectionId, RegularCollectionId } from "metabase-types/api";

import type {
  LibrarySection,
  SelectedItem,
} from "../hooks/library-bulk-selection.utils";
import { useMoveLibraryItems } from "../hooks/useMoveLibraryItems";

type LibraryBulkActionsProps = {
  selectedItems: SelectedItem[];
  selectionSection: LibrarySection | null;
  /** The active section's library collection — the Move picker's default focus. */
  defaultCollectionId: CollectionId | undefined;
  onMoved: (
    section: LibrarySection,
    affectedCollectionIds: CollectionId[],
  ) => void;
  onClear: () => void;
};

/**
 * Floating bulk-action bar for the Library. Move is universal (all sections);
 * the destination picker is scoped to the selection's section. (Unpublish for
 * all-table selections is wired in a later checkpoint.)
 */
export function LibraryBulkActions({
  selectedItems,
  selectionSection,
  defaultCollectionId,
  onMoved,
  onClear,
}: LibraryBulkActionsProps) {
  const [isMoveOpen, setIsMoveOpen] = useState(false);
  const moveItems = useMoveLibraryItems();
  const { sendSuccessToast, sendErrorToast } = useMetadataToasts();

  const count = selectedItems.length;
  const message = ngettext(
    msgid`${count} item selected`,
    `${count} items selected`,
    count,
  );

  // A collection can't be moved into itself or one of its descendants.
  const movingCollectionIds = useMemo(
    () =>
      selectedItems
        .filter((item) => item.model === "collection")
        .map((item) => String(item.entityId)),
    [selectedItems],
  );

  const handleMove = async (destinationId: RegularCollectionId | null) => {
    const section = selectionSection;
    if (section == null) {
      setIsMoveOpen(false);
      return;
    }
    try {
      const { failedCount, affectedCollectionIds } = await moveItems(
        selectedItems,
        destinationId,
      );
      if (failedCount > 0) {
        sendErrorToast(t`Couldn't move ${failedCount} of ${count} items`);
      } else {
        sendSuccessToast(t`Moved`);
      }
      onMoved(section, affectedCollectionIds);
    } finally {
      setIsMoveOpen(false);
    }
  };

  return (
    <>
      <BulkActionBar opened={count > 0} message={message}>
        <BulkActionButton onClick={() => setIsMoveOpen(true)}>
          {t`Move`}
        </BulkActionButton>
        <BulkActionButton onClick={onClear}>{t`Clear`}</BulkActionButton>
      </BulkActionBar>
      {isMoveOpen && selectionSection != null && (
        <LibraryMoveModal
          section={selectionSection}
          initialCollectionId={
            selectedItems[0]?.sourceCollectionId ?? defaultCollectionId ?? null
          }
          movingCollectionIds={movingCollectionIds}
          onMove={handleMove}
          onClose={() => setIsMoveOpen(false)}
        />
      )}
    </>
  );
}

type MovePickerItem = {
  id: string | number;
  model: string;
  location?: string | null;
  effective_location?: string | null;
};

/**
 * True when a collection picker item can't be a move destination because it is,
 * or is a descendant of, one of the collections being moved (would create a cycle).
 */
export function isMoveDestinationDisabled(
  item: MovePickerItem,
  movingCollectionIds: string[],
): boolean {
  if (item.model !== "collection" || movingCollectionIds.length === 0) {
    return false;
  }
  const fullPath = (item.effective_location ?? item.location ?? "")
    .split("/")
    .filter(Boolean)
    .concat(String(item.id));
  return fullPath.some((id) => movingCollectionIds.includes(id));
}

type LibraryMoveModalProps = {
  section: LibrarySection;
  initialCollectionId: CollectionId | null;
  movingCollectionIds: string[];
  onMove: (destinationId: RegularCollectionId | null) => void;
  onClose: () => void;
};

function LibraryMoveModal({
  section,
  initialCollectionId,
  movingCollectionIds,
  onMove,
  onClose,
}: LibraryMoveModalProps) {
  const isDisabledItem = useCallback(
    (item: OmniPickerItem) =>
      isMoveDestinationDisabled(item, movingCollectionIds),
    [movingCollectionIds],
  );

  if (section === "snippets") {
    return (
      <CollectionPickerModal
        title={t`Move to…`}
        value={undefined}
        onChange={(destination) =>
          onMove(
            destination.id === "root"
              ? null
              : (destination.id as RegularCollectionId),
          )
        }
        onClose={onClose}
        namespaces={["snippets"]}
        isDisabledItem={isDisabledItem}
        options={{
          hasPersonalCollections: false,
          canCreateCollections: true,
          hasRootCollection: true,
          hasSearch: false,
          hasConfirmButtons: true,
          hasRecents: false,
          hasLibrary: false,
        }}
      />
    );
  }

  return (
    <CollectionPickerModal
      title={t`Move to…`}
      value={
        initialCollectionId != null
          ? { id: initialCollectionId, model: "collection" }
          : undefined
      }
      onChange={(destination) => onMove(destination.id as RegularCollectionId)}
      onClose={onClose}
      isDisabledItem={isDisabledItem}
      options={{
        hasLibrary: true,
        hasRootCollection: false,
        hasPersonalCollections: false,
        hasSearch: true,
        hasRecents: false,
        hasConfirmButtons: true,
        confirmButtonText: t`Move`,
      }}
      entityType={section === "data" ? "table" : "metric"}
    />
  );
}
