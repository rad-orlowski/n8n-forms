import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}
interface State {
  error: Error | null;
}

/**
 * Root render-time backstop. A crash in the form tree shows a recoverable card
 * instead of a blank white screen.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("[app] render error:", error, info.componentStack);
  }

  render(): ReactNode {
    if (this.state.error) {
      return (
        <div className="mx-auto w-full max-w-2xl px-5 py-16 text-center animate-rise">
          <p className="label-tech mb-4">error</p>
          <h2 className="font-display text-xl font-semibold mb-2">
            Something went wrong
          </h2>
          <p className="text-muted-foreground text-sm mb-6">
            The console hit an unexpected error. Reloading usually clears it.
          </p>
          <a
            href="#/"
            onClick={() => this.setState({ error: null })}
            className="label-tech text-primary hover:underline underline-offset-4"
          >
            ← back to console
          </a>
        </div>
      );
    }
    return this.props.children;
  }
}
