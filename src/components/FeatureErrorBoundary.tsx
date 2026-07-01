/**
 * Feature-level error boundary.
 * Wrap any workspace pane so a render-time crash never blanks the whole app.
 */
import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";
import { logger } from "@/lib/logger";

interface Props {
  /** Name of the surrounding feature; used in logs + fallback copy. */
  feature: string;
  fallback?: ReactNode;
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class FeatureErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    logger.error(`feature:${this.props.feature}`, error, info.componentStack);
  }

  reset = () => this.setState({ error: null });

  render() {
    if (!this.state.error) return this.props.children;
    if (this.props.fallback) return this.props.fallback;

    return (
      <div
        role="alert"
        className="flex flex-col items-center justify-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-6 text-center"
      >
        <AlertTriangle className="h-6 w-6 text-destructive" aria-hidden />
        <div>
          <p className="font-medium text-foreground">{this.props.feature} hit an error</p>
          <p className="text-sm text-muted-foreground">{this.state.error.message}</p>
        </div>
        <Button size="sm" variant="outline" onClick={this.reset}>
          Try again
        </Button>
      </div>
    );
  }
}
