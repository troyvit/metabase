import {
  setupRevisionsEndpoints,
  setupUsersEndpoints,
} from "__support__/server-mocks";
import {
  renderWithProviders,
  screen,
  waitForLoaderToBeRemoved,
} from "__support__/ui";
import { QuestionActivityTimeline } from "metabase/query_builder/components/QuestionActivityTimeline";
import type Question from "metabase-lib/v1/Question";
import { createMockUserListResult } from "metabase-types/api/mocks";
import { createMockRevision } from "metabase-types/api/mocks/revision";

interface SetupOpts {
  question: Question;
}

async function setup({ question }: SetupOpts) {
  setupRevisionsEndpoints([
    createMockRevision(),
    createMockRevision({ id: 2 }),
  ]);
  setupUsersEndpoints([createMockUserListResult()]);
  renderWithProviders(<QuestionActivityTimeline question={question} />);
  await waitForLoaderToBeRemoved();
}

describe("QuestionActivityTimeline", () => {
  describe("when the user does not have perms to modify the question", () => {
    const question = {
      canWrite: () => false,
      getModerationReviews: () => [],
      id: () => 1,
    } as unknown as Question;

    it("should not render revert action buttons", async () => {
      await setup({ question });
      expect(() => screen.getByTestId("question-revert-button")).toThrow();
    });
  });

  describe("when the user does have perms to modify the question", () => {
    const question = {
      canWrite: () => true,
      getModerationReviews: () => [],
      id: () => 1,
    } as unknown as Question;

    it("should render revert action buttons", async () => {
      await setup({ question });
      expect(screen.getByTestId("question-revert-button")).toBeInTheDocument();
    });
  });
});
