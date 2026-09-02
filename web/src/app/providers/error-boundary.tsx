import { Component, type ErrorInfo, type ReactNode } from "react";
import { ErrorState } from "@/components/feedback/error-state";

interface Props {
  children: ReactNode;
}
interface State {
  error: Error | null;
}

/** Top-level crash boundary — catches render errors below the providers. */
export class AppErrorBoundary extends Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    // Last-resort surface until an error tracker is wired.
    console.error("Unhandled UI error", error, info.componentStack);
  }

  override render(): ReactNode {
    if (this.state.error) {
      return (
        <div className="flex min-h-dvh items-center justify-center bg-canvas p-6">
          <div className="w-full max-w-md">
            <ErrorState error={this.state.error} onRetry={() => window.location.reload()} />
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
