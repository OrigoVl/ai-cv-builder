import { Download, MessageCircleQuestion, UploadCloud } from "lucide-react";

const STEPS = [
  {
    icon: UploadCloud,
    title: "Add your background",
    text: "Upload a PDF of your current CV, or just describe your experience in a few sentences — then tell us the role you're targeting.",
  },
  {
    icon: MessageCircleQuestion,
    title: "Review & answer a few questions",
    text: "The AI drafts a CV from your own facts — never invented ones. Anything missing or unclear becomes a quick question for you to answer.",
  },
  {
    icon: Download,
    title: "Edit and download",
    text: "Tweak any field by hand, then download a clean, ATS-friendly A4 PDF with real, selectable text.",
  },
];

export function HowItWorks() {
  return (
    <div className="card-flat border-dashed">
      <h2 className="text-sm font-semibold text-gray-900">How it works</h2>
      <ol className="mt-4 grid gap-5 sm:grid-cols-3">
        {STEPS.map(({ icon: Icon, title, text }, i) => (
          <li key={title} className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                <Icon className="h-4 w-4" />
              </span>
              <span className="text-xs font-semibold text-gray-400">Step {i + 1}</span>
            </div>
            <p className="text-sm font-medium text-gray-800">{title}</p>
            <p className="text-sm leading-relaxed text-gray-500">{text}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}
