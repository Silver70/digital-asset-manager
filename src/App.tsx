import { ClerkProvider } from "@clerk/clerk-react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthGuard } from "./components/Auth/AuthGuard";

const queryClient = new QueryClient();

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

if (!PUBLISHABLE_KEY) {
  throw new Error(
    "VITE_CLERK_PUBLISHABLE_KEY is not set. Add it to your .env file.",
  );
}

function App() {
  return (
    <ClerkProvider publishableKey={PUBLISHABLE_KEY}>
      <QueryClientProvider client={queryClient}>
        <AuthGuard>
          {/* AppLayout replaces this placeholder in Phase 3+ */}
          <div className="flex items-center justify-center min-h-screen bg-gray-900">
            <div className="text-center">
              <h1 className="text-3xl font-bold text-white mb-2">
                DAM — Digital Asset Manager
              </h1>
              <p className="text-gray-400">
                Phase 2 complete — authenticated, org selected, storage configured.
              </p>
            </div>
          </div>
        </AuthGuard>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

export default App;
