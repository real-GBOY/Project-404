import { Component, type ErrorInfo, type ReactNode } from "react";
import { ErrorState } from "@/components/feedback/error-state";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/** Catches render errors within one routed page so a crash there doesn't take down the whole shell. */
export class RouteErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Route error:", error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="px-[18px] pt-4">
          <ErrorState
            title="This page hit an error"
            message={this.state.error.message}
            onRetry={() => this.setState({ error: null })}
          />
        </div>
      );
    }
    return this.props.children;
  }
}
