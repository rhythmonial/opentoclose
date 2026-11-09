"use client";

import { Component, type ReactNode } from "react";

// Catches a problem inside one document review, so it shows a reload
// button in its own box instead of taking the whole page down.
export class DocumentBoundary extends Component<
  { children: ReactNode },
  { failed: boolean; attempt: number }
> {
  state = { failed: false, attempt: 0 };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (this.state.failed) {
      return (
        <div className="rounded-lg border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
          <p className="font-semibold">Something went wrong showing this document.</p>
          <p className="mt-0.5 text-ink-soft">Your saved work is safe.</p>
          <button
            type="button"
            onClick={() => this.setState((s) => ({ failed: false, attempt: s.attempt + 1 }))}
            className="mt-2 rounded-lg bg-accent px-3.5 py-2 text-sm font-semibold text-white"
          >
            Reload document
          </button>
        </div>
      );
    }
    return <div key={this.state.attempt}>{this.props.children}</div>;
  }
}
