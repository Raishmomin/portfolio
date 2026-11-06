"use client";

// Contains a client subtree's render errors (e.g. the lazy 3D stage: WebGL context loss,
// a scene bug, a Fast Refresh of a stale chunk in dev). Without it the error climbs to the
// root, Next re-renders <html> on the client and React warns about the head script.
// Renders `fallback` (default: nothing) once its children throw.
import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = { children: ReactNode; fallback?: ReactNode };

export class ErrorBoundary extends Component<Props, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    if (process.env.NODE_ENV !== "production") console.warn("[ErrorBoundary] contained:", error, info.componentStack);
  }

  render() {
    return this.state.failed ? (this.props.fallback ?? null) : this.props.children;
  }
}
