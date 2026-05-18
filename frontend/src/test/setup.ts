import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";
import type React from "react";

vi.mock("@clerk/clerk-react", () => ({
  useUser: () => ({ user: null, isLoaded: true }),
  useAuth: () => ({ isSignedIn: false, getToken: async () => null }),
  SignedIn: ({ children }: { children: React.ReactNode }) => children,
  SignedOut: ({ children }: { children: React.ReactNode }) => children,
  ClerkProvider: ({ children }: { children: React.ReactNode }) => children,
  UserButton: () => null,
}));
