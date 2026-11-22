import { useCallback, useMemo, useState } from 'react';
import { AnimatePresence, MotionConfig, motion } from 'framer-motion';
import { AuthProvider, useAuth } from './context/AuthContext';
import { DataProvider } from './context/DataContext';
import { ToastProvider } from './context/ToastContext';
import { NavigationContext } from './context/NavigationContext';
import { PrivacyProvider } from './context/PrivacyContext';
import AppShell from './components/layout/AppShell';
import ErrorBoundary from './components/layout/ErrorBoundary';
import LaunchActions from './components/layout/LaunchActions';
import Logo from './components/ui/Logo';
import LoginPage from './features/auth/LoginPage';
import HomePage from './features/home/HomePage';
import ActivityPage from './features/activity/ActivityPage';
import DebtsPage from './features/debts/DebtsPage';
import InsightsPage from './features/insights/InsightsPage';
import SettingsPage from './features/settings/SettingsPage';
import TransactionEditor from './features/transactions/TransactionEditor';
import AppLockGate from './features/lock/AppLockGate';

const PAGES = {
  home: HomePage,
  activity: ActivityPage,
  debts: DebtsPage,
  insights: InsightsPage,
  settings: SettingsPage,
};

function Splash() {
  return (
    <div className="grid min-h-dvh place-items-center">
      <motion.div animate={{ scale: [1, 1.08, 1] }} transition={{ duration: 1.4, repeat: Infinity }}>
        <Logo size={64} />
      </motion.div>
    </div>
  );
}

function SignedInApp() {
  // `param` carries context into a page, e.g. a category for Activity or a section for Settings.
  const [route, setRoute] = useState({ page: 'home', param: null, key: 0 });
  const navigate = useCallback((page, param = null) => {
    setRoute((r) => ({ page, param, key: r.key + 1 }));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const navigation = useMemo(() => ({ page: route.page, navigate }), [route.page, navigate]);
  const Page = PAGES[route.page];
  const pageProps = {
    onNavigate: navigate,
    initialCategory: route.page === 'activity' ? route.param : undefined,
    initialSection: route.page === 'settings' ? route.param : undefined,
  };

  return (
    <PrivacyProvider>
      <DataProvider>
        <NavigationContext.Provider value={navigation}>
          <AppShell page={route.page} onNavigate={navigate}>
            <AnimatePresence mode="wait">
              <motion.div
                key={`${route.page}-${route.key}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              >
                <Page {...pageProps} />
              </motion.div>
            </AnimatePresence>
          </AppShell>
        </NavigationContext.Provider>
        <TransactionEditor />
        <LaunchActions />
      </DataProvider>
    </PrivacyProvider>
  );
}

function Root() {
  const { status } = useAuth();
  if (status === 'checking') return <Splash />;
  return status === 'signed-in' ? (
    <AppLockGate>
      <SignedInApp />
    </AppLockGate>
  ) : (
    <LoginPage />
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <MotionConfig reducedMotion="user">
        <ToastProvider>
          <AuthProvider>
            <Root />
          </AuthProvider>
        </ToastProvider>
      </MotionConfig>
    </ErrorBoundary>
  );
}
