import userEvent from "@testing-library/user-event";

import { renderWithProviders, screen } from "__support__/ui";
import type { TreeItem } from "metabase/data-studio/common/types";
import {
  TreeTable,
  type TreeTableColumnDef,
  useTreeTableInstance,
} from "metabase/ui";
import type { CollectionId } from "metabase-types/api";
import {
  createMockCollection,
  createMockCollectionItem,
} from "metabase-types/api/mocks";

import { useLibraryBulkSelection } from "./useLibraryBulkSelection";

// The virtualizer needs a non-zero viewport to render rows in jsdom, otherwise
// no body rows (and no checkboxes) are produced.
beforeAll(() => {
  jest.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
    width: 800,
    height: 600,
    top: 0,
    left: 0,
    right: 800,
    bottom: 600,
    x: 0,
    y: 0,
    toJSON: () => {},
  } as DOMRect);
  Object.defineProperty(HTMLElement.prototype, "offsetHeight", {
    configurable: true,
    value: 600,
  });
  Object.defineProperty(HTMLElement.prototype, "clientHeight", {
    configurable: true,
    value: 600,
  });
});

afterAll(() => {
  jest.restoreAllMocks();
});

function tableItem(id: number): TreeItem {
  return {
    id: `table:${id}`,
    name: `Table ${id}`,
    icon: "table",
    model: "table",
    data: createMockCollectionItem({ id, model: "table", name: `Table ${id}` }),
  };
}

function dataSectionRoot(children: TreeItem[]): TreeItem {
  const id: CollectionId = 100;
  return {
    id: `collection:${id}`,
    name: "Data",
    icon: "folder",
    model: "collection",
    data: {
      ...createMockCollection({
        id,
        type: "library-data",
        is_library_root: true,
      }),
      model: "collection",
    },
    children,
  };
}

const columns: TreeTableColumnDef<TreeItem>[] = [
  {
    id: "name",
    header: "Name",
    cell: ({ row }) => <span>{row.original.name}</span>,
  },
];

function Harness({ data }: { data: TreeItem[] }) {
  const instance = useTreeTableInstance<TreeItem>({
    data,
    columns,
    getNodeId: (n) => n.id,
    // eslint-disable-next-line testing-library/no-node-access -- TreeItem.children, not a DOM node
    getSubRows: (n) => n.children,
    getRowCanExpand: (r) => r.original.model === "collection",
    defaultExpanded: true,
  });
  const { selectedItems, getSelectionState, onCheckboxClick } =
    useLibraryBulkSelection(instance.rows);
  return (
    <>
      <TreeTable
        instance={instance}
        showCheckboxes
        getSelectionState={getSelectionState}
        onCheckboxClick={onCheckboxClick}
        // Rows are links in the real Library; the checkbox must still toggle
        // without navigating (and without a one-render checked lag).
        getRowHref={(row) => `/data-studio/library/tables/${row.original.id}`}
      />
      <div data-testid="count">{selectedItems.length}</div>
    </>
  );
}

const checkboxes = () => screen.getAllByRole("checkbox") as HTMLInputElement[];

describe("useLibraryBulkSelection — TreeTable checkbox rendering", () => {
  it("checks a row's checkbox immediately on click (no one-render lag)", async () => {
    renderWithProviders(
      <Harness data={[tableItem(1), tableItem(2), tableItem(3)]} />,
    );

    // No header select-all checkbox; one checkbox per row.
    expect(checkboxes()).toHaveLength(3);

    await userEvent.click(checkboxes()[0]);
    expect(checkboxes()[0].checked).toBe(true);
    expect(screen.getByTestId("count")).toHaveTextContent("1");

    await userEvent.click(checkboxes()[1]);
    expect(checkboxes()[0].checked).toBe(true);
    expect(checkboxes()[1].checked).toBe(true);
    expect(screen.getByTestId("count")).toHaveTextContent("2");
  });

  it("section-root checkbox selects and clears the whole section immediately", async () => {
    renderWithProviders(
      <Harness data={[dataSectionRoot([tableItem(1), tableItem(2)])]} />,
    );

    // rows: [Data (section root), Table 1, Table 2]
    expect(checkboxes()).toHaveLength(3);

    await userEvent.click(checkboxes()[0]);
    expect(checkboxes()[1].checked).toBe(true);
    expect(checkboxes()[2].checked).toBe(true);
    expect(screen.getByTestId("count")).toHaveTextContent("2");

    await userEvent.click(checkboxes()[0]);
    expect(checkboxes()[1].checked).toBe(false);
    expect(checkboxes()[2].checked).toBe(false);
    expect(screen.getByTestId("count")).toHaveTextContent("0");
  });
});
