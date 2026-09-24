import React, { useState } from 'react';
import { BusinessStoreProvider, useBusinessStore } from './lib/store';
import { Sidebar } from './components/layout/Sidebar';
import { Header } from './components/layout/Header';
import { MobileNav } from './components/layout/MobileNav';
import { ToastContainer } from './components/layout/ToastContainer';
import { AskDoctorModal } from './components/layout/AskDoctorModal';
import { NotificationsModal } from './components/layout/NotificationsModal';
import { OnboardingFlow } from './components/onboarding/OnboardingFlow';
import { AuthModal } from './components/auth/AuthModal';
import { ProtectedRoute } from './components/common/ProtectedRoute';

// Views
import { DashboardView } from './components/views/DashboardView';
import { CRMOverviewView } from './components/views/CRMOverviewView';
import { AIDiagnosisView } from './components/views/AIDiagnosisView';
import { TrialView } from './components/views/TrialView';
import { CustomersView } from './components/views/CustomersView';
import { LeadsView } from './components/views/LeadsView';
import { MarketingView } from './components/views/MarketingView';
import { AIAgentsView } from './components/views/AIAgentsView';
import { AutomationsView } from './components/views/AutomationsView';
import { ProductsView } from './components/views/ProductsView';
import { ServicesView } from './components/views/ServicesView';
import { OrdersView } from './components/views/OrdersView';
import { BookingsView } from './components/views/BookingsView';
import { ExpensesView } from './components/views/ExpensesView';
import { SalesAnalyticsView } from './components/views/SalesAnalyticsView';
import { BusinessMemoryView } from './components/views/BusinessMemoryView';
import { DataIntegrationView } from './components/views/DataIntegrationView';
import { SettingsView } from './components/views/SettingsView';
import { ConnectorsView } from './components/views/ConnectorsView';

const MainAppContent: React.FC = () => {
  const {
    currentView,
    setCurrentView,
    isOnboardingOpen,
    setIsOnboardingOpen,
    isAuthModalOpen,
    setIsAuthModalOpen,
    isAskDoctorOpen,
    setIsAskDoctorOpen,
    isNotificationsOpen,
    setIsNotificationsOpen,
  } = useBusinessStore();

  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

  const renderActiveView = () => {
    switch (currentView) {
      case 'dashboard':
        return (
          <ProtectedRoute routeKey="dashboard">
            <DashboardView onNavigate={setCurrentView} />
          </ProtectedRoute>
        );
      case 'diagnosis':
      case 'ai_diagnosis':
        return (
          <ProtectedRoute routeKey="ai_diagnosis">
            <AIDiagnosisView />
          </ProtectedRoute>
        );
      case 'trial':
      case 'reports':
        return (
          <ProtectedRoute routeKey="reports">
            <TrialView />
          </ProtectedRoute>
        );
      case 'crm':
      case 'crm_overview':
        return (
          <ProtectedRoute routeKey="crm">
            <CRMOverviewView onNavigate={setCurrentView} />
          </ProtectedRoute>
        );
      case 'customers':
        return (
          <ProtectedRoute routeKey="customers">
            <CustomersView />
          </ProtectedRoute>
        );
      case 'leads':
        return (
          <ProtectedRoute routeKey="leads">
            <LeadsView />
          </ProtectedRoute>
        );
      case 'marketing':
        return (
          <ProtectedRoute routeKey="marketing">
            <MarketingView />
          </ProtectedRoute>
        );
      case 'agents':
      case 'ai_agents':
        return (
          <ProtectedRoute routeKey="ai_agents">
            <AIAgentsView />
          </ProtectedRoute>
        );
      case 'automations':
        return (
          <ProtectedRoute routeKey="automations">
            <AutomationsView />
          </ProtectedRoute>
        );
      case 'products':
        return (
          <ProtectedRoute routeKey="products">
            <ProductsView />
          </ProtectedRoute>
        );
      case 'services':
        return (
          <ProtectedRoute routeKey="services">
            <ServicesView />
          </ProtectedRoute>
        );
      case 'orders':
        return (
          <ProtectedRoute routeKey="orders">
            <OrdersView />
          </ProtectedRoute>
        );
      case 'bookings':
        return (
          <ProtectedRoute routeKey="bookings">
            <BookingsView />
          </ProtectedRoute>
        );
      case 'expenses':
        return (
          <ProtectedRoute routeKey="expenses">
            <ExpensesView />
          </ProtectedRoute>
        );
      case 'sales_analytics':
      case 'analytics':
      case 'pnl':
        return (
          <ProtectedRoute routeKey="sales_analytics">
            <SalesAnalyticsView onNavigate={setCurrentView} />
          </ProtectedRoute>
        );
      case 'memory':
      case 'business_memory':
        return (
          <ProtectedRoute routeKey="business_memory">
            <BusinessMemoryView />
          </ProtectedRoute>
        );
      case 'integrations':
      case 'data':
        return (
          <ProtectedRoute routeKey="integrations">
            <DataIntegrationView />
          </ProtectedRoute>
        );
      case 'connectors':
      case 'connector_hub':
        return (
          <ProtectedRoute routeKey="connectors">
            <ConnectorsView />
          </ProtectedRoute>
        );
      case 'settings':
      case 'business':
        return (
          <ProtectedRoute routeKey="settings">
            <SettingsView />
          </ProtectedRoute>
        );
      default:
        return (
          <ProtectedRoute routeKey="dashboard">
            <DashboardView onNavigate={setCurrentView} />
          </ProtectedRoute>
        );
    }
  };

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100 overflow-hidden font-sans antialiased selection:bg-indigo-600 selection:text-white">
      {/* Desktop Sidebar */}
      <Sidebar currentModule={currentView} onNavigate={setCurrentView} />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* Top Header */}
        <Header
          currentModule={currentView}
          onNavigate={setCurrentView}
          onOpenMobileMenu={() => setIsMobileNavOpen(true)}
          onStartOnboarding={() => setIsOnboardingOpen(true)}
          onOpenAuthModal={() => setIsAuthModalOpen(true)}
        />

        {/* Dynamic Scrollable Page Content */}
        <main className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 py-6 pb-24 md:pb-8">
          <div className="max-w-7xl mx-auto">{renderActiveView()}</div>
        </main>

        {/* Mobile Bottom Navigation & Drawer */}
        <MobileNav
          isOpen={isMobileNavOpen}
          onClose={() => setIsMobileNavOpen(false)}
          currentModule={currentView}
          onNavigate={setCurrentView}
        />
      </div>

      {/* Global Modals & Notifications */}
      <ToastContainer />
      <AskDoctorModal isOpen={isAskDoctorOpen} onClose={() => setIsAskDoctorOpen(false)} />
      <NotificationsModal
        isOpen={isNotificationsOpen}
        onClose={() => setIsNotificationsOpen(false)}
        onNavigate={setCurrentView}
      />
      {isOnboardingOpen && <OnboardingFlow />}
      {isAuthModalOpen && <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} />}
    </div>
  );
};

export default function App() {
  return (
    <BusinessStoreProvider>
      <MainAppContent />
    </BusinessStoreProvider>
  );
}
