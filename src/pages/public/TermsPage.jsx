import { Link } from "react-router-dom";
import { PublicPage } from "../../components/site/SiteChrome";
import { Reveal } from "../../components/site/Reveal";

const sections = [
  {
    title: "Account responsibility",
    paragraphs: [
      "You are responsible for providing accurate registration information and for keeping your login credentials private.",
      "Only create and use an account for yourself. Contact support if you believe your account has been accessed without permission.",
    ],
  },
  {
    title: "Investment risk",
    paragraphs: [
      "Digital assets and investment products carry risk, including the possible loss of principal. Past performance and displayed projections do not guarantee future results.",
      "Review each package, its duration, fees, and conditions carefully before committing funds. Do not commit money you cannot afford to lose.",
    ],
  },
  {
    title: "Platform use",
    paragraphs: [
      "You agree to use MeridianVests lawfully and not to interfere with the platform, bypass access controls, submit misleading information, or misuse another member's data.",
      "We may restrict or suspend access where required for security, compliance, maintenance, or suspected misuse.",
    ],
  },
  {
    title: "Withdrawals and support",
    paragraphs: [
      "Withdrawal requests are subject to account review, available funds, network conditions, and the applicable processing terms shown in the platform.",
      "Support can help explain account processes, but it cannot guarantee investment performance, processing times, or market outcomes.",
    ],
  },
];

export default function TermsPage() {
  return (
    <PublicPage>
      <main id="main-content" tabIndex="-1" className="bg-slate-50/80 px-4 py-12 sm:py-16 lg:py-24">
        <div className="mx-auto w-full max-w-[900px]">
          <Reveal className="mb-10 border-b border-slate-200 pb-10 sm:mb-14 sm:pb-14">
            <p className="mb-5 flex items-center gap-3 text-[10px] font-extrabold uppercase tracking-[0.18em] text-slate-700">
              <span className="block h-2.5 w-2.5 bg-sky-400" /> Legal
              information
            </p>
            <h1 className="text-[clamp(2.25rem,7vw,3.5rem)] font-semibold leading-[1.08] tracking-[-0.05em] text-slate-900">
              Terms and conditions
            </h1>
            <p className="mt-5 max-w-2xl text-sm leading-7 text-slate-700">
              Please read these terms before creating an account. By selecting
              the agreement checkbox during signup, you confirm that you have
              read and accepted these conditions.
            </p>
            <p className="mt-4 text-xs font-semibold uppercase tracking-[0.12em] text-blue-700">
              Last updated: September 17, 2026
            </p>
          </Reveal>

          <div className="space-y-8">
            {sections.map(({ title, paragraphs }, index) => (
              <Reveal
                as="section"
                key={title}
                className="border-b border-slate-200 pb-8 last:border-b-0 sm:pb-10"
                style={{ "--reveal-delay": `${index * 90}ms` }}
              >
                <h2 className="text-xl font-semibold tracking-[-0.03em] text-slate-900 sm:text-2xl">
                  {index + 1}. {title}
                </h2>
                <div className="mt-4 space-y-4 text-sm leading-7 text-slate-700">
                  {paragraphs.map((paragraph) => (
                    <p key={paragraph}>{paragraph}</p>
                  ))}
                </div>
              </Reveal>
            ))}
          </div>

          <div className="mt-10 flex flex-col gap-4 border-t border-slate-200 pt-8 text-sm text-slate-700 sm:flex-row sm:items-center sm:justify-between">
            <span>Questions about these terms?</span>
            <Link
              to="/support"
              className="inline-flex min-h-11 items-center justify-center rounded-md bg-sky-400 px-5 text-xs font-extrabold uppercase tracking-[0.12em] text-slate-950 transition hover:-translate-y-0.5 hover:bg-cyan-300"
            >
              Contact support
            </Link>
          </div>
        </div>
      </main>
    </PublicPage>
  );
}
