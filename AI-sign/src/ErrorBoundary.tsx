import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
    state: State = { hasError: false, error: null };

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, info: ErrorInfo) {
        console.error("ErrorBoundary caught:", error, info.componentStack);
    }

    render() {
        if (this.state.hasError) {
            return (
                this.props.fallback ?? (
                    <div
                        role="alert"
                        style={{
                            padding: "2rem",
                            textAlign: "center",
                            color: "#ef4444",
                        }}
                    >
                        <h2>Something went wrong.</h2>
                        <p style={{ fontSize: "0.85rem", opacity: 0.7 }}>
                            {this.state.error?.message}
                        </p>
                        <button
                            onClick={() => this.setState({ hasError: false, error: null })}
                            style={{ marginTop: "1rem" }}
                        >
                            Try again
                        </button>
                    </div>
                )
            );
        }
        return this.props.children;
    }
}

export default ErrorBoundary;
