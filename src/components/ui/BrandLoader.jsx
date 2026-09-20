export default function BrandLoader({ label = "Loading your MeridianVests experience" }) {
  return (
    <div
      className="grid min-h-screen place-items-center bg-[#07111d] px-6 text-white"
      role="status"
      aria-label={label}
    >
      <div className="flex flex-col items-center text-center">
        <div className="motion-safe:animate-pulse">
          <img
            src="/meridianvest-logo.svg"
            alt=""
            className="h-14 w-14 rounded-2xl object-cover"
            width="56"
            height="56"
          />
        </div>
        <p className="mt-5 text-2xl font-extrabold tracking-[-0.06em]">
          Meridian<span className="text-sky-400">Vests</span>
        </p>
      </div>
    </div>
  );
}
