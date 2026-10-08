"use client";
import { Component, ReactNode } from "react";
export class VisualizationBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (this.state.failed) return <div role="alert" className="rounded-lg border border-amber-500/30 p-5 text-sm text-amber-200">This view could not render. You can still open other sections or download the evidence report.<button className="block mt-3 px-3 py-2 bg-slate-800 rounded-lg text-white" onClick={() => this.setState({ failed: false })}>Retry this view</button></div>;
    return this.props.children;
  }
}
