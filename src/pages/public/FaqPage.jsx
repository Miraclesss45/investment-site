import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { PublicPage } from "../../components/site/SiteChrome";
import { Reveal } from "../../components/site/Reveal";

const faqTabs = ["General", "Deposits", "Withdrawals"];

const faqContent = {
  General: [
    {
      question: "Who can register with MeridianVests?",
      answer: "Anyone who is of legal age can register with MeridianVests.",
    },
    {
      question: "How do I create a personal account?",
      answer:
        "Choose Sign Up, enter your personal details, add your wallet information, accept the terms, and submit the registration form.",
    },
    {
      question: "How is my personal information handled?",
      answer:
        "Your account information is handled through the platform's authentication and protected account processes. Use a strong, unique password and contact support if you notice anything unusual.",
    },
    {
      question: "Can I create multiple accounts?",
      answer:
        "Create and use one personal account for your activity. Contact support if you need help with an existing account.",
    },
  ],
  Deposits: [
    {
      question: "What deposit currencies are supported?",
      answer:
        "The current deposit options are Litecoin, Bitcoin, and Ethereum. Always select the correct asset and network before sending funds.",
    },
    {
      question: "What are the package durations?",
      answer:
        "Review the selected package details before submitting a request. Contact support if a package's terms are missing or unclear.",
    },
    {
      question: "Will my deposit be returned?",
      answer:
        "Returns are not guaranteed. Package rates are illustrative targets and requests are subject to eligibility, review, and the applicable platform terms. Do not commit money you cannot afford to lose.",
    },
  ],
  Withdrawals: [
    {
      question: "How long does it take for my withdrawal to be sent?",
      answer:
        "Withdrawals are requests for review, not instant transfers. Timing depends on account review, available funds, platform processing, and network confirmation. Contact support if you need an update.",
    },
    {
      question: "Which wallet addresses can I use?",
      answer:
        "Use a wallet address that matches the selected asset and network. Save the address in your profile, check it carefully, and never send an asset to an incompatible network. Incorrect addresses may not be recoverable.",
    },
    {
      question: "How do I request a deposit or withdrawal?",
      answer:
        "Sign in, choose Deposit or Withdraw, enter the requested details, and submit the request for review. Deposits are not credited automatically, and withdrawals are not sent until they have been reviewed.",
    },
  ],
};

export default function FaqPage() {
  const [activeTab, setActiveTab] = useState("General");
  const [openQuestion, setOpenQuestion] = useState(
    faqContent.General[0].question,
  );

  function selectTab(tab) {
    setActiveTab(tab);
    setOpenQuestion(faqContent[tab][0].question);
  }

  function handleTabKey(event, tab) {
    const currentIndex = faqTabs.indexOf(tab);
    let nextIndex = currentIndex;

    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      nextIndex = (currentIndex + 1) % faqTabs.length;
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      nextIndex = (currentIndex - 1 + faqTabs.length) % faqTabs.length;
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = faqTabs.length - 1;
    } else {
      return;
    }

    event.preventDefault();
    const nextTab = faqTabs[nextIndex];
    selectTab(nextTab);
    document.getElementById(`faq-tab-${nextTab.toLowerCase()}`)?.focus();
  }

  return (
    <PublicPage>
      <main id="main-content" tabIndex="-1" className="bg-slate-50/70 px-4 py-12 sm:py-16 lg:py-[94px]">
        <div className="mx-auto w-[min(1160px,calc(100%_-_2rem))] sm:w-[min(1160px,calc(100%_-_3rem))] lg:w-[min(1160px,calc(100%_-_5rem))]">
          <div
            className="mx-auto mb-10 grid min-w-0 max-w-[520px] grid-cols-[repeat(3,minmax(0,1fr))] gap-2 sm:mb-14 sm:flex sm:justify-center sm:gap-3"
            role="tablist"
            aria-label="FAQ topics"
          >
            {faqTabs.map((tab) => (
              <button
                key={tab}
                type="button"
                id={`faq-tab-${tab.toLowerCase()}`}
                role="tab"
                aria-selected={tab === activeTab}
                aria-controls={`faq-panel-${tab.toLowerCase()}`}
                tabIndex={tab === activeTab ? 0 : -1}
                onKeyDown={(event) => handleTabKey(event, tab)}
                className={
                  tab === activeTab
                    ? "h-11 min-w-0 w-full overflow-hidden rounded-full bg-sky-400 px-1 text-[10px] font-extrabold uppercase tracking-[0.04em] text-ellipsis text-slate-950 sm:min-w-[120px] sm:px-5 sm:text-[11px] sm:tracking-[0.12em]"
                    : "h-11 min-w-0 w-full overflow-hidden rounded-full border border-slate-200 bg-blue-50 px-1 text-[10px] font-extrabold uppercase tracking-[0.04em] text-ellipsis text-slate-800 sm:min-w-[120px] sm:px-5 sm:text-[11px] sm:tracking-[0.12em]"
                }
                onClick={() => selectTab(tab)}
              >
                {tab}
              </button>
            ))}
          </div>
          <div className="grid gap-10 lg:grid-cols-[0.72fr_1.28fr] lg:gap-14">
            <Reveal>
              <div className="mb-6 flex items-center gap-3 text-[10px] font-extrabold uppercase tracking-[0.18em] text-slate-700">
                <span className="block h-2.5 w-2.5 bg-sky-400" /> FAQ
              </div>
              <h1 className="mb-5 text-[clamp(2rem,7vw,2.625rem)] font-semibold leading-[1.12] tracking-[-0.05em] text-slate-900">
                Answers for members who value clarity.
              </h1>
              <p className="text-sm leading-7 text-slate-700">
                We focus on straightforward explanations, transparent decision
                points, and useful guidance at each stage of the journey.
              </p>
            </Reveal>
            <div
              id={`faq-panel-${activeTab.toLowerCase()}`}
              className="space-y-4 border-t border-slate-200 pt-4"
              role="tabpanel"
              aria-labelledby={`faq-tab-${activeTab.toLowerCase()}`}
              tabIndex="0"
            >
              {faqContent[activeTab].map(({ question, answer }, index) => (
                <Reveal
                  as="div"
                  key={question}
                  className="rounded-lg border border-slate-200 bg-white"
                  style={{ "--reveal-delay": `${index * 80}ms` }}
                >
                  <button
                    type="button"
                    id={`faq-question-${activeTab.toLowerCase()}-${index}`}
                    aria-controls={`faq-answer-${activeTab.toLowerCase()}-${index}`}
                    className="flex w-full items-center justify-between gap-3 p-4 text-left text-base font-semibold text-slate-900 transition hover:text-blue-700 sm:gap-4 sm:p-5 sm:text-lg"
                    aria-expanded={openQuestion === question}
                    onClick={() =>
                      setOpenQuestion((current) =>
                        current === question ? "" : question,
                      )
                    }
                  >
                    {question}
                    <ChevronRight
                      size={20}
                      className={`shrink-0 transition-transform ${openQuestion === question ? "rotate-90 text-blue-700" : ""}`}
                    />
                  </button>
                  <div
                    id={`faq-answer-${activeTab.toLowerCase()}-${index}`}
                    className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out ${openQuestion === question ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}
                    aria-hidden={openQuestion !== question}
                    aria-labelledby={`faq-question-${activeTab.toLowerCase()}-${index}`}
                  >
                    <div className="min-h-0 overflow-hidden">
                      <p className="px-5 pb-5 text-sm leading-7 text-slate-700">
                        {answer}
                      </p>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </div>
      </main>
    </PublicPage>
  );
}
