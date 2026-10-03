import React from "react";
import { Sparkles, Wand2, ArrowRight, Check } from "lucide-react";

export default function GenericLandingPage() {
  return (
    <div className="min-h-screen bg-[#09090b] text-white font-sans selection:bg-purple-500">
      {/* Background radial glow and blobs */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[500px] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-purple-900/40 via-transparent to-transparent blur-3xl pointer-events-none" />
      <div className="absolute top-20 right-10 w-72 h-72 rounded-full bg-purple-600/20 blur-3xl" />

      {/* Hero Section */}
      <header className="relative pt-32 pb-20 px-6 max-w-7xl mx-auto text-center">
        <span className="eyebrow uppercase tracking-wider text-xs font-semibold px-4 py-1.5 rounded-full bg-purple-950/60 border border-purple-800 text-purple-300">
          ✨ Next-gen AI platform
        </span>

        <h1 className="mt-8 text-7xl font-extrabold tracking-tight">
          Supercharge your workflow with <span className="bg-gradient-to-r from-purple-400 via-pink-400 to-indigo-400 bg-clip-text text-transparent">intelligent</span> automation
        </h1>

        <p className="mt-6 text-xl text-zinc-400 max-w-3xl mx-auto">
          The future of productivity is here. Our platform is powerful, seamless, and intelligent — built for developers, loved by teams.
        </p>

        {/* Generic Pill Buttons with dead links */}
        <div className="mt-10 flex items-center justify-center gap-4">
          <a
            href="#"
            className="rounded-full px-8 py-3.5 bg-gradient-to-r from-purple-500 to-indigo-600 hover:scale-105 transition-all shadow-lg shadow-purple-500/25 font-medium outline-none"
          >
            Start Free Today <ArrowRight className="inline w-4 h-4 ml-1" />
          </a>
          <button
            onClick={() => {}}
            className="rounded-full px-8 py-3.5 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 transition-all font-medium outline-none"
          >
            Book a Demo
          </button>
        </div>

        {/* Fake Live Online Indicator */}
        <div className="mt-6 flex items-center justify-center gap-2 text-sm text-zinc-400">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
          </span>
          <span>24 people viewing right now</span>
        </div>

        {/* Decorative Simulated Terminal Window */}
        <div className="mt-16 max-w-2xl mx-auto rounded-xl bg-black/80 border border-zinc-800 p-4 text-left font-mono text-sm shadow-2xl backdrop-blur-md">
          <div className="flex gap-2 mb-3">
            <span className="w-3 h-3 rounded-full bg-red-500" />
            <span className="w-3 h-3 rounded-full bg-yellow-500" />
            <span className="w-3 h-3 rounded-full bg-green-500" />
          </div>
          <p className="text-zinc-500">$ npx create-magic-app@latest</p>
          <p className="text-purple-400">Installing cutting-edge AI dependencies...</p>
        </div>
      </header>

      {/* Three Column Feature Cards */}
      <section className="py-20 px-6 max-w-7xl mx-auto">
        <h2 className="text-4xl font-bold text-center mb-12">
          Everything you need to scale: <span className="bg-gradient-to-r from-purple-400 to-indigo-400 bg-clip-text text-transparent">effortlessly</span>
        </h2>

        <div className="grid grid-cols-3 gap-8">
          <div className="rounded-3xl p-8 bg-zinc-900/60 border border-zinc-800 backdrop-blur-md hover:scale-105 transition-all shadow-xl">
            <div className="w-12 h-12 rounded-full bg-purple-950 flex items-center justify-center text-purple-400 mb-6">
              <Sparkles className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold">Blazing Fast Speed</h3>
            <p className="mt-2 text-zinc-400">Transform your workflow with sub-millisecond execution times.</p>
          </div>

          <div className="rounded-3xl p-8 bg-zinc-900/60 border border-zinc-800 backdrop-blur-md hover:scale-105 transition-all shadow-xl">
            <div className="w-12 h-12 rounded-full bg-purple-950 flex items-center justify-center text-purple-400 mb-6">
              <Wand2 className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold">Automated Intelligence</h3>
            <p className="mt-2 text-zinc-400">Let cutting-edge models handle your repetitive boilerplate.</p>
          </div>

          <div className="rounded-3xl p-8 bg-zinc-900/60 border border-zinc-800 backdrop-blur-md hover:scale-105 transition-all shadow-xl">
            <div className="w-12 h-12 rounded-full bg-purple-950 flex items-center justify-center text-purple-400 mb-6">
              <Check className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold">Enterprise Grade</h3>
            <p className="mt-2 text-zinc-400">Security that empowers your teams from idea to production.</p>
          </div>
        </div>
      </section>

      {/* Bento Grid with Nested Glass Cards */}
      <section className="py-20 px-6 max-w-7xl mx-auto">
        <div className="grid grid-cols-3 gap-6">
          <div className="col-span-2 rounded-3xl p-8 bg-zinc-900/50 border border-zinc-800 backdrop-blur-lg">
            <h4 className="text-2xl font-bold">Comprehensive Analytics</h4>
            <div className="mt-6 p-6 rounded-2xl bg-zinc-950/60 border border-zinc-800/80 backdrop-blur-sm">
              <p className="text-zinc-400">Real-time metrics stream.</p>
            </div>
          </div>
          <div className="rounded-3xl p-8 bg-zinc-900/50 border border-zinc-800 backdrop-blur-lg">
            <h4 className="text-2xl font-bold">Instant Deploy</h4>
          </div>
        </div>
      </section>

      {/* Unverified Testimonial Section */}
      <section className="py-20 px-6 max-w-4xl mx-auto text-center">
        <p className="text-2xl italic text-zinc-300">
          "This tool changed everything. Our team will never be the same again."
        </p>
        <p className="mt-4 font-semibold text-purple-400">Sarah M., CEO at TechCorp</p>
      </section>

      {/* Accessibility issue: Icon button missing aria-label, img missing alt */}
      <footer className="py-12 border-t border-zinc-800 text-center">
        <button className="p-3 bg-zinc-900 rounded-full hover:bg-zinc-800 outline-none">
          <Sparkles className="w-5 h-5 text-purple-400" />
        </button>
        <img src="/logo.png" className="mx-auto mt-4 w-8 h-8" />
        <p className="mt-4 text-xs text-zinc-600">© 2026 TechCorp. All rights reserved.</p>
      </footer>
    </div>
  );
}
