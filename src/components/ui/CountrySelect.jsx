import { ChevronDown } from "lucide-react";
import { countryOptions } from "../../lib/countries";

export default function CountrySelect({
  id = "country",
  name = "country",
  defaultValue = "",
  value,
  required = false,
}) {
  const controlled = value !== undefined;

  return (
    <div className="relative mt-2">
      <select
        id={id}
        name={name}
        defaultValue={controlled ? undefined : defaultValue}
        value={controlled ? value : undefined}
        required={required}
        autoComplete="country-name"
        className="!bg-none h-[58px] w-full appearance-none rounded-xl border border-white/10 bg-[#081321] px-4 pr-11 text-sm text-slate-100 shadow-inner shadow-black/10 outline-none transition hover:border-white/20 focus:border-cyan-300 focus:bg-[#0b1a2c] focus:ring-4 focus:ring-cyan-300/10 [color-scheme:dark]"
      >
        <option value="" disabled>
          Select your country
        </option>
        {countryOptions.map((country) => (
          <option key={country} value={country} className="bg-[#0d1728] text-white">
            {country}
          </option>
        ))}
        <option value="Other" className="bg-[#0d1728] text-white">
          Other
        </option>
      </select>
      <ChevronDown
        size={18}
        aria-hidden="true"
        className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-cyan-300"
      />
    </div>
  );
}
