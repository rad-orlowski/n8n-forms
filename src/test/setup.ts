import "@testing-library/jest-dom";

// jsdom does not implement window.matchMedia. Provide a minimal stub so
// components that call useIsBreakpoint (and any other MQL consumers) don't
// throw during unit tests. The mock always returns false (desktop-width
// assumed), which is fine for behaviour-focused tests.
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string): MediaQueryList =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList,
});
