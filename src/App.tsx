import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { UiModeProvider } from "@/contexts/UiModeContext";
import RequireModeChosen from "@/components/RequireModeChosen";
import ProtectedRoute from "@/components/ProtectedRoute";
import AdminRoute from "@/components/AdminRoute";
import LandingPage from "./pages/LandingPage";
import AuthPage from "./pages/AuthPage";
import ResetPassword from "./pages/ResetPassword";
import PendingApproval from "./pages/PendingApproval";
import Dashboard from "./pages/Dashboard";
import ProjectWorkspace from "./pages/ProjectWorkspace";
import NewProject from "./pages/NewProject";
import DocumentEditorPage from "./pages/DocumentEditorPage";
import AdminDashboard from "./pages/AdminDashboard";
import UnsubscribePage from "./pages/UnsubscribePage";
import SurveyPage from "./pages/SurveyPage";
import PrivacyPolicyPage from "./pages/PrivacyPolicyPage";
import NotFound from "./pages/NotFound";
import OAuthCallback from "./pages/OAuthCallback";
import PromptsPage from "./pages/PromptsPage";
import LlmModelsPage from "./pages/LlmModelsPage";
import IntegrationsPage from "./pages/IntegrationsPage";
import ModeChooserPage from "./pages/ModeChooserPage";
import StudioDashboard from "./pages/studio/StudioDashboard";
import StudioProject from "./pages/studio/StudioProject";
import StudioRequirementsReview from "./pages/studio/StudioRequirementsReview";
import ExperimentGround from "./pages/ExperimentGround";
import ExperimentsHub from "./pages/ExperimentsHub";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <UiModeProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/auth" element={<AuthPage />} />
            <Route path="/iframe-oauth/callback" element={<OAuthCallback />} />
            <Route path="/oauth/callback" element={<OAuthCallback />} />
            {/* Legacy Lovable OAuth broker paths — recover into the SPA auth flow */}
            <Route path="/~oauth/*" element={<OAuthCallback />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/pending-approval" element={<PendingApproval />} />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/project/new"
              element={
                <ProtectedRoute>
                  <NewProject />
                </ProtectedRoute>
              }
            />
            <Route
              path="/project/:projectId"
              element={
                <ProtectedRoute>
                  <ProjectWorkspace />
                </ProtectedRoute>
              }
            />
            <Route
              path="/project/:projectId/document"
              element={
                <ProtectedRoute>
                  <DocumentEditorPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin"
              element={
                <AdminRoute>
                  <AdminDashboard />
                </AdminRoute>
              }
            />
            <Route path="/unsubscribe" element={<UnsubscribePage />} />
            <Route path="/survey" element={<SurveyPage />} />
            <Route path="/privacy" element={<PrivacyPolicyPage />} />
            <Route
              path="/prompts"
              element={
                <ProtectedRoute>
                  <PromptsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/llm-models"
              element={
                <ProtectedRoute>
                  <LlmModelsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/integrations"
              element={
                <ProtectedRoute>
                  <IntegrationsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/onboarding/mode"
              element={
                <ProtectedRoute>
                  <ModeChooserPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/studio/dashboard"
              element={
                <ProtectedRoute>
                  <StudioDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/studio/project/:projectId"
              element={
                <ProtectedRoute>
                  <StudioProject />
                </ProtectedRoute>
              }
            />
            <Route
              path="/studio/project/:projectId/requirements"
              element={
                <ProtectedRoute>
                  <StudioRequirementsReview />
                </ProtectedRoute>
              }
            />
            <Route
              path="/experiments"
              element={
                <ProtectedRoute>
                  <ExperimentsHub />
                </ProtectedRoute>
              }
            />
            <Route
              path="/experiments/:projectId"
              element={
                <ProtectedRoute>
                  <ExperimentGround />
                </ProtectedRoute>
              }
            />

            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
        </TooltipProvider>
      </UiModeProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
