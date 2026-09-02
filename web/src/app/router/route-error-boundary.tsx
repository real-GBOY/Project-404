import { Component, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { ErrorState } from "@/components/feedback/error-state";

interface Props {
  children: ReactNode;
  /** changes on navigation so a failed route recovers when the user moves away */
  resetKey: string;
}
interface State {
  error: unknown;
}

class Boundary extends Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: unknown): State {
    return { error };
  }

  override componentDidUpdate(prev: Props) {
    if (prev.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: null });
    }
  }

  override render() {
    if (this.state.error) {
      return (
        <div className="p-6">
          <ErrorState
            error={this.state.error}
            onRetry={() => this.setState({ error: null })}
          />
        </div>
      );
    }
    return this.props.children;
  }
}

/** Isolates a render error in the routed content to the content region. */
export function RouteErrorBoundary({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  return <Boundary resetKey={pathname}>{children}</Boundary>;
}
