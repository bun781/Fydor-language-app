import { Component, type ReactNode } from "react";
import { PageState } from "@/components/system/PageState";

interface ErrorBoundaryState {
  error: Error | null;
}

// Replaces the Next.js app/error.tsx + app/global-error.tsx pair: any render
// error anywhere in the tree lands here instead of a blank window.
export class ErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error(error);
  }

  render() {
    if (!this.state.error) return this.props.children;

    const details = this.state.error.stack ?? this.state.error.message;
    return (
      <main style={{ padding: 32 }}>
        <PageState
          eyebrow="Application error"
          tone="error"
          title="This page failed to load"
          description="The app hit an unrecoverable render error. The details below identify the failure."
          details={details}
          actions={
            <button className="button" type="button" onClick={() => this.setState({ error: null })}>
              Try again
            </button>
          }
        />
      </main>
    );
  }
}
