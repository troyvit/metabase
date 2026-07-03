import { attachIframeUrlMirror } from "./attach-iframe-url-mirror";

type Listener = () => void;

/**
 * A minimal same-origin frame `window`: its `history.pushState`/`replaceState`
 * update `location.pathname` (as the browser's do), so the mirror reads the
 * post-navigation path.
 */
const createFakeIframeWindow = (initialPath: string) => {
  const listeners: Record<string, Listener[]> = {};
  const location = { pathname: initialPath };
  const history = {
    state: null as unknown,
    pushState(state: unknown, _title: string, url: string) {
      this.state = state;
      location.pathname = url;
    },
    replaceState(state: unknown, _title: string, url: string) {
      this.state = state;
      location.pathname = url;
    },
  };

  return {
    location,
    history,
    addEventListener(type: string, cb: Listener) {
      (listeners[type] ??= []).push(cb);
    },
    removeEventListener(type: string, cb: Listener) {
      listeners[type] = (listeners[type] ?? []).filter((l) => l !== cb);
    },
    emit(type: string) {
      (listeners[type] ?? []).forEach((cb) => cb());
    },
    listenerCount(type: string) {
      return (listeners[type] ?? []).length;
    },
  };
};

type SetupOpts = { parentPath: string; iframePath: string; name?: string };

const setup = ({ parentPath, iframePath, name = "sales" }: SetupOpts) => {
  window.history.replaceState({}, "", parentPath);
  const iframe = createFakeIframeWindow(iframePath);
  const originalPush = iframe.history.pushState;
  const originalReplace = iframe.history.replaceState;
  // The mirror only touches history/location/addEventListener on the frame.
  const detach = attachIframeUrlMirror(iframe as unknown as Window, name);

  return { iframe, detach, originalPush, originalReplace };
};

describe("attachIframeUrlMirror", () => {
  afterEach(() => window.history.replaceState({}, "", "/"));

  it("mirrors an iframe pushState sub-route into the parent URL", () => {
    const { iframe } = setup({
      parentPath: "/data-app/sales",
      iframePath: "/embed/data-app/sales",
    });

    iframe.history.pushState({}, "", "/embed/data-app/sales/orders/42");

    expect(window.location.pathname).toBe("/data-app/sales/orders/42");
  });

  it("mirrors iframe replaceState navigations too", () => {
    const { iframe } = setup({
      parentPath: "/data-app/sales",
      iframePath: "/embed/data-app/sales",
    });

    iframe.history.replaceState({}, "", "/embed/data-app/sales/reports");

    expect(window.location.pathname).toBe("/data-app/sales/reports");
  });

  it("mirrors iframe popstate (browser back/forward inside the frame)", () => {
    const { iframe } = setup({
      parentPath: "/data-app/sales/orders",
      iframePath: "/embed/data-app/sales/orders",
    });

    iframe.location.pathname = "/embed/data-app/sales";
    iframe.emit("popstate");

    expect(window.location.pathname).toBe("/data-app/sales");
  });

  it("preserves the parent's query string and hash", () => {
    const { iframe } = setup({
      parentPath: "/data-app/sales?tab=1#top",
      iframePath: "/embed/data-app/sales",
    });

    iframe.history.pushState({}, "", "/embed/data-app/sales/orders");

    expect(
      window.location.pathname + window.location.search + window.location.hash,
    ).toBe("/data-app/sales/orders?tab=1#top");
  });

  it("mirrors via replaceState, never pushState (no parent history clutter)", () => {
    const parentPush = jest.spyOn(window.history, "pushState");
    const parentReplace = jest.spyOn(window.history, "replaceState");
    const { iframe } = setup({
      parentPath: "/data-app/sales",
      iframePath: "/embed/data-app/sales",
    });
    parentReplace.mockClear();

    iframe.history.pushState({}, "", "/embed/data-app/sales/orders");

    expect(parentReplace).toHaveBeenCalledTimes(1);
    expect(parentPush).not.toHaveBeenCalled();
    parentPush.mockRestore();
    parentReplace.mockRestore();
  });

  it("does not touch the parent URL when the target already matches", () => {
    const { iframe } = setup({
      parentPath: "/data-app/sales",
      iframePath: "/embed/data-app/sales",
    });
    const parentReplace = jest.spyOn(window.history, "replaceState");

    // Same effective path -> no-op.
    iframe.history.replaceState({}, "", "/embed/data-app/sales");

    expect(parentReplace).not.toHaveBeenCalled();
    parentReplace.mockRestore();
  });

  it("restores the original history methods and removes the listener on teardown", () => {
    const { iframe, detach, originalPush, originalReplace } = setup({
      parentPath: "/data-app/sales",
      iframePath: "/embed/data-app/sales",
    });
    expect(iframe.history.pushState).not.toBe(originalPush);
    expect(iframe.listenerCount("popstate")).toBe(1);

    detach();

    expect(iframe.history.pushState).toBe(originalPush);
    expect(iframe.history.replaceState).toBe(originalReplace);
    expect(iframe.listenerCount("popstate")).toBe(0);
  });
});
