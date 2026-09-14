import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}
interface State {
  error: Error | null;
}

/** Top-level crash guard — anything a route-level boundary didn't catch (provider setup, etc). */
export class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Application error:", error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ minHeight: "100dvh", display: "grid", placeItems: "center", background: "#F6F6F4" }}>
          <div style={{ textAlign: "center", maxWidth: 360 }}>
            <h1 style={{ fontSize: 16, fontWeight: 600 }}>Something went wrong</h1>
            <p style={{ fontSize: 12, color: "#6E6E6A", marginTop: 6 }}>{this.state.error.message}</p>
            <button
              type="button"
              onClick={() => window.location.assign("/dashboard")}
              style={{
                marginTop: 14,
                background: "#1B4DB8",
                color: "#fff",
                border: 0,
                borderRadius: 3,
                padding: "7px 14px",
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              Back to dashboard
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
