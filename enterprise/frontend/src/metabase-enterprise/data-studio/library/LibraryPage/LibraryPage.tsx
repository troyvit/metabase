import { useDisclosure } from "@mantine/hooks";
import { useCallback, useEffect, useMemo, useState } from "react";
import { t } from "ttag";

import { useListCollectionsTreeQuery } from "metabase/api";
import { ListEmptyState } from "metabase/common/components/ListEmptyState";
import { DataStudioBreadcrumbs } from "metabase/common/data-studio/components/DataStudioBreadcrumbs";
import { PaneHeader } from "metabase/common/data-studio/components/PaneHeader";
import { useHasTokenFeature } from "metabase/common/hooks";
import { SectionLayout } from "metabase/data-studio/app/components/SectionLayout";
import { LibraryUpsellPage } from "metabase/data-studio/upsells/pages";
import {
  Card,
  Flex,
  Icon,
  Stack,
  TextInput,
  TreeTable,
  TreeTableSkeleton,
} from "metabase/ui";
import type { CollectionId } from "metabase-types/api";

import { LibraryEmptyState } from "../components/LibraryEmptyState";

import { CreateMenu } from "./components/CreateMenu";
import { LibraryBulkActions } from "./components/LibraryBulkActions";
import { PublishTableModal } from "./components/PublishTableModal";
import { useLibraryCollections, useLibraryTreeTableInstance } from "./hooks";
import type { LibrarySection } from "./hooks/library-bulk-selection.utils";
import { useLibraryBulkSelection } from "./hooks/useLibraryBulkSelection";
import { getTreeRowHref, getWritableCollection } from "./utils";

export function LibraryPage() {
  const hasLibraryFeature = useHasTokenFeature("library");

  if (!hasLibraryFeature) {
    return <LibraryUpsellPage />;
  }

  return <LibraryPageContent />;
}

function LibraryPageContent() {
  const [searchQuery, setSearchQuery] = useState("");
  const [
    showPublishTableModal,
    { open: openPublishTableModal, close: closePublishTableModal },
  ] = useDisclosure(false);
  const { data: collections = [], isLoading: isLoadingCollections } =
    useListCollectionsTreeQuery({
      "exclude-other-user-collections": true,
      "exclude-archived": true,
      "include-library": true,
    });
  const {
    treeTableInstance,
    isChildrenLoading,
    isLoading,
    emptyMessage,
    refreshTableCollections,
    refreshMetricCollections,
  } = useLibraryTreeTableInstance({
    collections,
    isLoadingCollections,
    searchQuery,
    onPublishTableClick: openPublishTableModal,
  });

  const { libraryCollection, tableCollection, metricCollection } =
    useLibraryCollections(collections);
  const writableMetricCollection = useMemo(
    () =>
      libraryCollection &&
      getWritableCollection(libraryCollection, "library-metrics"),
    [libraryCollection],
  );

  const {
    selectedItems,
    selectionSection,
    getSelectionState,
    onCheckboxClick,
    clear: clearSelection,
  } = useLibraryBulkSelection(treeTableInstance.rows);

  // Clear selection when entering or leaving search (the tree content changes).
  const isSearching = searchQuery.trim().length > 0;
  useEffect(() => {
    clearSelection();
  }, [isSearching, clearSelection]);

  // The library collection for the active section — the Move picker's default
  // focus when an item's own source collection isn't known.
  const moveDefaultCollectionId =
    selectionSection === "data"
      ? tableCollection?.id
      : selectionSection === "metrics"
        ? metricCollection?.id
        : undefined;

  const handleMoved = useCallback(
    (section: LibrarySection, affectedCollectionIds: CollectionId[]) => {
      if (section === "data") {
        refreshTableCollections(affectedCollectionIds);
      } else if (section === "metrics") {
        refreshMetricCollections(affectedCollectionIds);
      }
      // Snippet sections refetch via RTK tag invalidation.
      clearSelection();
    },
    [refreshTableCollections, refreshMetricCollections, clearSelection],
  );

  return (
    <>
      <SectionLayout>
        <PaneHeader
          breadcrumbs={
            <DataStudioBreadcrumbs>{t`Library`}</DataStudioBreadcrumbs>
          }
          px="3.5rem"
          py={0}
        />
        <Stack
          bg="background_page-secondary"
          data-testid="library-page"
          pb="2rem"
          px="3.5rem"
          style={{ overflow: "hidden" }}
        >
          {!libraryCollection && !isLoadingCollections ? (
            <LibraryEmptyState />
          ) : (
            <>
              <Flex gap="md">
                <TextInput
                  placeholder={t`Search...`}
                  leftSection={<Icon name="search" />}
                  bdrs="md"
                  flex="1"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                <CreateMenu
                  metricCollectionId={writableMetricCollection?.id}
                  canWriteToMetricCollection={!!writableMetricCollection}
                  dataCollectionId={tableCollection?.id}
                  canWriteToDataCollection={!!tableCollection?.can_write}
                />
              </Flex>
              <Card withBorder p={0}>
                {isLoading ? (
                  <TreeTableSkeleton columnWidths={[0.6, 0.2, 0.05]} />
                ) : (
                  <TreeTable
                    instance={treeTableInstance}
                    showCheckboxes
                    getSelectionState={getSelectionState}
                    onCheckboxClick={onCheckboxClick}
                    emptyState={
                      emptyMessage ? (
                        <ListEmptyState label={emptyMessage} />
                      ) : null
                    }
                    onRowClick={(row) => {
                      if (row.original.model === "empty-state") {
                        return;
                      }
                      if (row.getCanExpand()) {
                        row.toggleExpanded();
                      }
                      // Navigation for leaf nodes is handled by the link
                    }}
                    getRowHref={getTreeRowHref}
                    isChildrenLoading={isChildrenLoading}
                  />
                )}
              </Card>
            </>
          )}
        </Stack>
      </SectionLayout>
      <PublishTableModal
        opened={showPublishTableModal}
        onClose={closePublishTableModal}
        onPublished={closePublishTableModal}
      />
      <LibraryBulkActions
        selectedItems={selectedItems}
        selectionSection={selectionSection}
        defaultCollectionId={moveDefaultCollectionId}
        onMoved={handleMoved}
        onClear={clearSelection}
      />
    </>
  );
}
