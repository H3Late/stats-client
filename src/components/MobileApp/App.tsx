import { useEffect, useMemo } from "react";
import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "@mui/material/styles";
import { Toaster } from "./components/ui/toaster";
import { TooltipProvider } from "./components/ui/tooltip";
import { useDarkMode } from "./hooks/useDarkMode";
import { createAppTheme } from "./lib/muiTheme";
import Dashboard from "./pages/Dashboard";
import LivestreamDataPage from "./pages/LivestreamDataPage";
import VotePage from "./pages/VotePage";
import NotFound from "./pages/not-found";

function RootRedirect() {
  const [, navigate] = useLocation();
  useEffect(() => {
    navigate("/dashboard");
  }, [navigate]);
  return null;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={RootRedirect} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/data" component={LivestreamDataPage} />
      <Route path="/vote" component={VotePage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  const colorMode = useDarkMode();
  const muiTheme = useMemo(() => createAppTheme(colorMode), [colorMode]);

  return (
    <ThemeProvider theme={muiTheme}>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
