import { Switch, Route, Router, Redirect } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { isAuthenticated } from "@/lib/auth";
import { AppSidebar } from "@/components/app-sidebar";
import NotFound from "@/pages/not-found";
import LoginPage from "@/pages/login";
import RegisterPage from "@/pages/register";
import ForgotPasswordPage from "@/pages/forgot-password";
import ResetPasswordPage from "@/pages/reset-password";
import DashboardPage from "@/pages/dashboard";
import QuickQAPage from "@/pages/quick-qa";
import ScenarioPage from "@/pages/scenario";
import ArticlePage from "@/pages/article";
import ReportPage from "@/pages/report";
import TaxAdvicePage from "@/pages/tax-advice";
import OutputsPage from "@/pages/outputs";
import OutputDetailPage from "@/pages/output-detail";
import DocumentsPage from "@/pages/documents";
import AdminPage from "@/pages/admin";

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  if (!isAuthenticated()) {
    return <Redirect to="/login" />;
  }
  return (
    <div className="flex min-h-screen">
      <AppSidebar />
      <main className="flex-1 ml-60 p-6 max-w-5xl">
        <Component />
      </main>
    </div>
  );
}

function AppRouter() {
  return (
    <Switch>
      {/* Public routes */}
      <Route path="/login" component={LoginPage} />
      <Route path="/register" component={RegisterPage} />
      <Route path="/forgot-password" component={ForgotPasswordPage} />
      <Route path="/reset-password" component={ResetPasswordPage} />

      {/* Protected routes */}
      <Route path="/">{() => <ProtectedRoute component={DashboardPage} />}</Route>
      <Route path="/quick-qa">{() => <ProtectedRoute component={QuickQAPage} />}</Route>
      <Route path="/scenario">{() => <ProtectedRoute component={ScenarioPage} />}</Route>
      <Route path="/article">{() => <ProtectedRoute component={ArticlePage} />}</Route>
      <Route path="/report">{() => <ProtectedRoute component={ReportPage} />}</Route>
      <Route path="/tax-advice">{() => <ProtectedRoute component={TaxAdvicePage} />}</Route>
      <Route path="/outputs">{() => <ProtectedRoute component={OutputsPage} />}</Route>
      <Route path="/outputs/:id">{() => <ProtectedRoute component={OutputDetailPage} />}</Route>
      <Route path="/documents">{() => <ProtectedRoute component={DocumentsPage} />}</Route>
      <Route path="/admin">{() => <ProtectedRoute component={AdminPage} />}</Route>

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router hook={useHashLocation}>
          <AppRouter />
        </Router>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
