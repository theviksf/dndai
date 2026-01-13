import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AgentErrorProvider } from "@/lib/agent-error-context";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import Settings from "@/pages/settings-wrapper";
import CharacterCreation from "@/pages/character-creation-wrapper";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/settings" component={Settings} />
      <Route path="/character-creation" component={CharacterCreation} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AgentErrorProvider>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </AgentErrorProvider>
    </QueryClientProvider>
  );
}

export default App;
