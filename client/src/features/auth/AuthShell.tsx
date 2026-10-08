import type { ReactNode } from "react";
import { FileText, ShieldCheck, Sparkles } from "lucide-react";
import { Logo } from "../../shared/Logo.js";

const POINTS = [
  { icon: Sparkles, text: "AI drafts your CV from a PDF or a few sentences — never invents facts." },
  { icon: FileText, text: "Edit any field by hand, then download a real, selectable-text PDF." },
  { icon: ShieldCheck, text: "Your CVs are private to your account, on any device you sign in from." },
];

/** Shared frame for the login/signup pages: a brand panel on desktop, a plain centered card on
 * mobile (the panel is decorative, not content, so it's the first thing dropped at narrow
 * widths). */
export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <div className="relative hidden w-[45%] flex-col justify-between overflow-hidden bg-gradient-to-br from-brand-700 via-brand-600 to-brand-800 p-10 text-white lg:flex">
        <div
          className="pointer-events-none absolute inset-0 opacity-20"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 20%, white 0, transparent 35%), radial-gradient(circle at 80% 70%, white 0, transparent 30%)",
          }}
        />
        <div className="relative">
          <Logo size={30} tone="dark" />
        </div>
        <div className="relative space-y-6">
          <h2 className="text-2xl font-semibold leading-snug">
            Your story, told clearly — never embellished.
          </h2>
          <ul className="space-y-4">
            {POINTS.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-start gap-3 text-sm text-brand-50">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/15">
                  <Icon className="h-3.5 w-3.5" />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-brand-200">© {new Date().getFullYear()} Brightfolio</p>
      </div>

      <div className="flex flex-1 items-center justify-center bg-gray-50 px-4 py-10">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex justify-center lg:hidden">
            <Logo size={32} />
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
