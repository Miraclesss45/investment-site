import { Link } from "react-router-dom";

export default function NotFoundPage() {
  return (
    <div className="relative flex min-h-screen items-center justify-center bg-[#050b14] px-6 text-white">
      <div className="max-w-xl text-center">
        <p className="text-xs font-extrabold uppercase tracking-[0.24em] text-sky-400">
          404
        </p>
        <h1 className="mt-5 text-4xl font-semibold tracking-[-0.05em] sm:text-5xl">
          This page does not exist.
        </h1>
        <p className="mt-5 text-base leading-7 text-slate-300">
          The link may be outdated or the page may have moved.
        </p>
        <Link
          to="/"
          className="mt-8 inline-flex h-12 items-center justify-center rounded-md bg-sky-400 px-6 text-sm font-extrabold uppercase tracking-[0.12em] text-slate-950 transition hover:-translate-y-0.5"
        >
          Go home
        </Link>
      </div>
    </div>
  );
}
