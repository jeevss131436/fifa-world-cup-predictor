import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "World Cup 2026 Simulator",
  description:
    "Predict 2026 FIFA World Cup group-stage matches with a machine-learning model.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <header className="border-b border-slate-200 bg-white/80 backdrop-blur">
          <div className="mx-auto flex max-w-5xl items-center gap-3 px-6 py-4">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-pitch-600 text-lg">
              ⚽
            </span>
            <div className="leading-tight">
              <p className="text-sm font-semibold tracking-tight text-slate-900">
                World Cup 2026
              </p>
              <p className="text-xs text-slate-500">Match Simulator</p>
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-5xl px-6 py-10">{children}</main>
        <footer className="mx-auto max-w-5xl px-6 py-10 text-center text-xs text-slate-400">
          Predictions are model estimates for entertainment purposes.
        </footer>
      </body>
    </html>
  );
}
