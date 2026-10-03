import React, { useState } from "react";

export function Navigation() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <nav className="border-b border-stone-200 bg-stone-50 py-4 px-6">
      <div className="flex justify-between items-center max-w-5xl mx-auto">
        <span className="font-serif font-bold text-lg text-stone-900">AeroMetrics</span>
        {/* Desktop Links */}
        <div className="hidden md:flex gap-6 text-sm text-stone-700">
          <a href="/telemetry" className="hover:text-stone-900 focus-visible:ring-2 focus-visible:ring-stone-600 rounded">Telemetry</a>
          <a href="/nodes" className="hover:text-stone-900 focus-visible:ring-2 focus-visible:ring-stone-600 rounded">Nodes</a>
          <a href="/alerts" className="hover:text-stone-900 focus-visible:ring-2 focus-visible:ring-stone-600 rounded">Alerts</a>
        </div>
        {/* Mobile Navigation Toggle */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="md:hidden p-2 rounded focus-visible:ring-2 focus-visible:ring-stone-600"
          aria-label="Toggle mobile navigation menu"
        >
          Menu
        </button>
      </div>
      {/* Mobile Drawer */}
      {isOpen && (
        <div className="mobile-nav md:hidden mt-4 pt-4 border-t border-stone-200 flex flex-col gap-3">
          <a href="/telemetry">Telemetry</a>
          <a href="/nodes">Nodes</a>
          <a href="/alerts">Alerts</a>
        </div>
      )}
    </nav>
  );
}
