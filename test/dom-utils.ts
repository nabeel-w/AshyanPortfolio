import { vi } from "vitest";

/** jsdom has no matchMedia. `matches(query)` decides each media query's result. */
export function mockMatchMedia(matches: (query: string) => boolean) {
  window.matchMedia = vi.fn((query: string) => ({
    matches: matches(query),
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia;
}
