import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { ClerkProvider } from "@clerk/clerk-react";
import { App } from "./App";
import { makeQueryClient } from "./lib/queryClient";
import "./styles/index.css";

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("#root not found");

const queryClient = makeQueryClient();
const clerkKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string | undefined;

const inner = (
  <QueryClientProvider client={queryClient}>
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <App />
    </BrowserRouter>
  </QueryClientProvider>
);

createRoot(rootEl).render(
  <StrictMode>
    {clerkKey ? (
      <ClerkProvider publishableKey={clerkKey}>{inner}</ClerkProvider>
    ) : (
      inner
    )}
  </StrictMode>,
);
