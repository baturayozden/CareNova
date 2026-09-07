import React from 'react';
import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AlertTriangle } from 'lucide-react';

// APP-ADMIN-EKSIKLER-KOMUTU.md Görev 1.3 — a single page crashing (the
// /commission white screen was the trigger) used to unmount the ENTIRE
// React tree, sidebar included, all the way up to #root, since nothing
// caught the error. This wraps <Outlet/> inside Layout.tsx so a broken
// route shows an inline message instead, and the sidebar/shell stay alive
// — the same class of bug can't take down the whole app again, whatever
// page it originates in next time.

interface InnerProps {
  resetKey: string;
  children: React.ReactNode;
  title: string;
  body: string;
  reloadLabel: string;
}
interface InnerState { hasError: boolean }

class RouteErrorBoundaryInner extends React.Component<InnerProps, InnerState> {
  state: InnerState = { hasError: false };

  static getDerivedStateFromError(): InnerState {
    return { hasError: true };
  }

  componentDidCatch(error: unknown, info: React.ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error('[RouteErrorBoundary] a route failed to render:', error, info.componentStack);
  }

  // Resets automatically on navigation (resetKey = pathname) — a fresh
  // route gets a fresh chance to render instead of staying stuck on the
  // error screen from whatever page crashed before it.
  componentDidUpdate(prevProps: InnerProps) {
    if (this.state.hasError && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false });
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-full min-h-[60vh] px-6 text-center gap-3">
          <AlertTriangle size={32} className="text-yellow-500" />
          <p className="text-white font-semibold text-lg">{this.props.title}</p>
          <p className="text-gray-400 text-sm max-w-sm">{this.props.body}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-2 px-4 py-2 text-sm bg-accent text-white rounded-lg hover:bg-accent/90 transition-colors"
          >
            {this.props.reloadLabel}
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function RouteErrorBoundary({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const { t } = useTranslation('common');
  return (
    <RouteErrorBoundaryInner
      resetKey={location.pathname}
      title={t('errorBoundary.title')}
      body={t('errorBoundary.body')}
      reloadLabel={t('errorBoundary.reload')}
    >
      {children}
    </RouteErrorBoundaryInner>
  );
}
