import { Component, type ErrorInfo, type ReactNode } from "react";

/** Last-resort boundary: a render bug must never leave a blank page. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Unhandled UI error", error, info.componentStack);
  }

  override render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div role="alert" style={{ padding: 24, fontFamily: "'IBM Plex Sans',system-ui,sans-serif" }}>
        <h1 style={{ fontSize: 18 }}>Something went wrong · حدث خطأ غير متوقع</h1>
        <button onClick={() => location.reload()} style={{ height: 40, padding: "0 16px", border: 0, borderRadius: 4, background: "#0F5C4A", color: "#fff", cursor: "pointer" }}>
          Reload · إعادة التحميل
        </button>
      </div>
    );
  }
}
