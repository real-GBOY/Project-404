import { Component, type ErrorInfo, type ReactNode } from "react";

interface State {
  failed: boolean;
}

/** Last-resort boundary: a render crash shows a calm recovery screen instead of a blank page. */
export class AppErrorBoundary extends Component<{ children: ReactNode }, State> {
  override state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("HotelOS render error", error, info.componentStack);
  }

  override render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div role="alert" className="flex min-h-full items-center justify-center p-8 text-center">
        <div>
          <h1 className="m-0 mb-2 text-heading font-extrabold">Something went wrong</h1>
          <p className="m-0 mb-5 text-body text-muted">Reload the page to continue.</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="cursor-pointer rounded-button bg-primary px-[18px] py-[11px] text-body font-bold text-white"
          >
            Reload
          </button>
        </div>
      </div>
    );
  }
}
