import userEvent from "@testing-library/user-event";
import fetchMock from "fetch-mock";

import { renderWithProviders, screen, waitFor } from "__support__/ui";

import type {
  LibrarySection,
  SelectedItem,
} from "../hooks/library-bulk-selection.utils";

import {
  LibraryBulkActions,
  isMoveDestinationDisabled,
} from "./LibraryBulkActions";

// The picker is exercised in e2e; here it just yields a destination collection.
jest.mock("metabase/common/components/Pickers", () => ({
  CollectionPickerModal: ({
    onChange,
    value,
  }: {
    onChange: (destination: { id: number; model: string }) => void;
    value?: { id: number | string };
  }) => (
    <div>
      <span data-testid="picker-value">{String(value?.id ?? "none")}</span>
      <button onClick={() => onChange({ id: 99, model: "collection" })}>
        Destination
      </button>
    </div>
  ),
}));

jest.mock("../../components/UnpublishTablesModal", () => ({
  UnpublishTablesModal: ({
    isOpened,
    tableIds,
    onUnpublish,
  }: {
    isOpened: boolean;
    tableIds: number[];
    onUnpublish: () => void;
  }) =>
    isOpened ? (
      <div>
        <span data-testid="unpublish-table-ids">{tableIds.join(",")}</span>
        <button onClick={onUnpublish}>Confirm unpublish</button>
      </div>
    ) : null,
}));

function item(
  model: SelectedItem["model"],
  entityId: number,
  sourceCollectionId: number | null,
): SelectedItem {
  return {
    key: `${model}:${entityId}`,
    model,
    section:
      model === "metric"
        ? "metrics"
        : model === "snippet"
          ? "snippets"
          : "data",
    entityId,
    sourceCollectionId,
    canWrite: true,
  };
}

function setup({
  selectedItems,
  selectionSection = "data",
  isAllTables = false,
  defaultCollectionId,
}: {
  selectedItems: SelectedItem[];
  selectionSection?: LibrarySection | null;
  isAllTables?: boolean;
  defaultCollectionId?: number;
}) {
  const onActionComplete = jest.fn();
  const onClear = jest.fn();
  renderWithProviders(
    <LibraryBulkActions
      selectedItems={selectedItems}
      selectionSection={selectionSection}
      isAllTables={isAllTables}
      defaultCollectionId={defaultCollectionId}
      onActionComplete={onActionComplete}
      onClear={onClear}
    />,
  );
  return { onActionComplete, onClear };
}

describe("isMoveDestinationDisabled", () => {
  const moving = ["5"]; // collection 5 is being moved

  it("disables the collection being moved (can't move into itself)", () => {
    expect(
      isMoveDestinationDisabled(
        { id: 5, model: "collection", location: "/1/" },
        moving,
      ),
    ).toBe(true);
  });

  it("disables a descendant of a collection being moved", () => {
    expect(
      isMoveDestinationDisabled(
        { id: 7, model: "collection", location: "/1/5/" },
        moving,
      ),
    ).toBe(true);
  });

  it("allows unrelated collections", () => {
    expect(
      isMoveDestinationDisabled(
        { id: 8, model: "collection", location: "/1/" },
        moving,
      ),
    ).toBe(false);
  });

  it("never disables non-collection items or when nothing is a collection", () => {
    expect(
      isMoveDestinationDisabled(
        { id: 9, model: "table", location: "/1/5/" },
        moving,
      ),
    ).toBe(false);
    expect(isMoveDestinationDisabled({ id: 5, model: "collection" }, [])).toBe(
      false,
    );
  });
});

describe("LibraryBulkActions", () => {
  it("shows the selected-item count and clears", async () => {
    const { onClear } = setup({ selectedItems: [item("table", 1, 10)] });

    expect(screen.getByText("1 item selected")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Clear" }));
    expect(onClear).toHaveBeenCalled();
  });

  it("defaults the move picker to the section's library collection, not the root", async () => {
    setup({
      // source collection unknown → must fall back to the section library, not "root"
      selectedItems: [item("table", 1, null)],
      selectionSection: "data",
      defaultCollectionId: 42,
    });

    await userEvent.click(screen.getByRole("button", { name: "Move" }));
    expect(screen.getByTestId("picker-value")).toHaveTextContent("42");
  });

  it("moves the selection to the chosen collection and reports affected collections", async () => {
    fetchMock.put("path:/api/table/1", { id: 1 }, { name: "t1" });
    fetchMock.put("path:/api/table/2", { id: 2 }, { name: "t2" });

    const { onActionComplete } = setup({
      selectedItems: [item("table", 1, 10), item("table", 2, 10)],
    });

    expect(screen.getByText("2 items selected")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Move" }));
    await userEvent.click(screen.getByRole("button", { name: "Destination" }));

    await waitFor(() => expect(onActionComplete).toHaveBeenCalled());
    expect(onActionComplete).toHaveBeenCalledWith(
      "data",
      expect.arrayContaining([10, 99]),
    );
    expect(
      await fetchMock.callHistory.lastCall("t1")?.request?.json(),
    ).toMatchObject({ collection_id: 99 });
    expect(
      await fetchMock.callHistory.lastCall("t2")?.request?.json(),
    ).toMatchObject({ collection_id: 99 });
  });

  it("shows Unpublish only when every selected item is a table", () => {
    setup({
      selectedItems: [item("table", 1, 10), item("collection", 2, 10)],
      isAllTables: false,
    });
    expect(
      screen.queryByRole("button", { name: "Unpublish" }),
    ).not.toBeInTheDocument();
  });

  it("unpublishes the selected tables and completes the action", async () => {
    const { onActionComplete } = setup({
      selectedItems: [item("table", 1, 10), item("table", 2, 11)],
      isAllTables: true,
    });

    await userEvent.click(screen.getByRole("button", { name: "Unpublish" }));
    expect(screen.getByTestId("unpublish-table-ids")).toHaveTextContent("1,2");

    await userEvent.click(
      screen.getByRole("button", { name: "Confirm unpublish" }),
    );
    expect(onActionComplete).toHaveBeenCalledWith(
      "data",
      expect.arrayContaining([10, 11]),
    );
  });
});
