import { isMoveDestinationDisabled } from "./LibraryBulkActions";

// The bar's Move/Unpublish flows, item count, Clear, default picker focus, and
// Unpublish visibility are all covered by the library e2e suite. The only thing
// unit-tested here is the move-destination cycle guard, whose descendant edge
// case the e2e doesn't exercise.
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
