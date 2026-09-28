import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import { countryOptions } from "../../lib/countries";

export default function CountrySelect({
  id = "country",
  name = "country",
  defaultValue = "",
  value,
  required = false,
}) {
  const isControlled = value !== undefined;
  const [selectedCountry, setSelectedCountry] = useState(defaultValue || "");
  const [customCountry, setCustomCountry] = useState("");

  useEffect(() => {
    if (isControlled) {
      setSelectedCountry(value || "");
      if (value && value !== "Other") {
        setCustomCountry("");
      }
    }
  }, [isControlled, value]);

  const showCustomInput = selectedCountry === "Other";

  const handleSelectChange = (event) => {
    const nextValue = event.target.value;
    setSelectedCountry(nextValue);
    if (nextValue !== "Other") {
      setCustomCountry("");
    }
  };

  return (
    <div className="relative mt-2">
      {!showCustomInput ? (
        <>
          <select
            id={id}
            name={name}
            value={isControlled ? value || "" : selectedCountry}
            onChange={handleSelectChange}
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
        </>
      ) : (
        <div>
          <div className="w-full rounded-xl border border-white/10 bg-[#081321] px-3 transition hover:border-sky-400/45 focus-within:border-sky-400 focus-within:bg-[#0b1a2c]">
            <input
              id={id}
              name={name}
              type="text"
              value={customCountry}
              onChange={(event) => setCustomCountry(event.target.value.trimStart())}
              placeholder="Type your country"
              autoComplete="country-name"
              maxLength={100}
              required={required}
              className="h-[58px] w-full bg-transparent text-sm text-white placeholder:text-slate-400 focus:outline-none"
            />
          </div>
          <button
            type="button"
            onClick={() => {
              setSelectedCountry("");
              setCustomCountry("");
            }}
            className="mt-2 text-xs font-semibold text-cyan-300 hover:text-cyan-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
          >
            Choose from the country list
          </button>
        </div>
      )}
    </div>
  );
}
