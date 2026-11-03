import { Link } from "react-router-dom";

export default function NotFoundPage() {
  return (
    <div className="relative flex min-h-screen items-center justify-center bg-slate-50 px-6 text-slate-900">
      <div className="max-w-xl text-center">
        <img
          src="/meridianvest-logo.svg"
          alt="MeridianVests logo"
          className="mx-auto mb-8 h-14 w-14 rounded-2xl"
          width="56"
          height="56"
        />
        <p className="text-xs font-extrabold uppercase tracking-[0.24em] text-blue-700">
          404
        </p>
        <h1 className="mt-5 text-4xl font-semibold tracking-[-0.05em] sm:text-5xl">
          This page does not exist.
        </h1>
        <p className="mt-5 text-base leading-7 text-slate-600">
          The link may be outdated or the page may have moved.
        </p>
        <Link
          to="/"
          className="mt-8 inline-flex h-12 items-center justify-center rounded-lg bg-blue-600 px-6 text-sm font-extrabold uppercase tracking-[0.12em] text-white transition hover:-translate-y-0.5 hover:bg-blue-700"
        >
          Go home
        </Link>
      </div>
    </div>
  );
}
