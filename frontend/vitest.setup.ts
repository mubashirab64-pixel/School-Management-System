import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// React Testing Library does not unmount between tests on its own here, and a
// leftover tree makes the next test's queries match the previous render.
afterEach(() => {
  cleanup();
});
