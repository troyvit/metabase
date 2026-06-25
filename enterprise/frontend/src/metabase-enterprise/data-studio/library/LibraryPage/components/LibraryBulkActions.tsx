import { msgid, ngettext, t } from "ttag";

import {
  BulkActionBar,
  BulkActionButton,
} from "metabase/common/components/BulkActionBar";

import type { SelectedItem } from "../hooks/library-bulk-selection.utils";

type LibraryBulkActionsProps = {
  selectedItems: SelectedItem[];
  onClear: () => void;
};

/**
 * Floating bulk-action bar for the Library. Shows the selected-item count.
 * Move / Unpublish buttons + their modals are wired in subsequent checkpoints.
 */
export function LibraryBulkActions({
  selectedItems,
  onClear,
}: LibraryBulkActionsProps) {
  const count = selectedItems.length;
  const message = ngettext(
    msgid`${count} item selected`,
    `${count} items selected`,
    count,
  );

  return (
    <BulkActionBar opened={count > 0} message={message}>
      <BulkActionButton onClick={onClear}>{t`Clear`}</BulkActionButton>
    </BulkActionBar>
  );
}
