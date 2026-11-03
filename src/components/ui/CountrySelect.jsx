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
            className="!bg-none h-[58px] w-full appearance-none rounded-xl border border-slate-200 bg-white px-4 pr-11 text-sm text-slate-900 shadow-sm outline-none transition hover:border-blue-300 focus:border-blue-600 focus:bg-blue-50 [color-scheme:light]"
          >
            <option value="" disabled>
              Select your country
            </option>
            {countryOptions.map((country) => (
              <option key={country} value={country} className="bg-white text-slate-900">
                {country}
              </option>
            ))}
            <option value="Other" className="bg-white text-slate-900">
              Other
            </option>
          </select>
          <ChevronDown
            size={18}
            aria-hidden="true"
            className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-blue-600"
          />
        </>
      ) : (
        <div>
          <div className="w-full rounded-xl border border-slate-200 bg-white px-3 transition hover:border-blue-300 focus-within:border-blue-600 focus-within:bg-blue-50">
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
              className="h-[58px] w-full bg-transparent text-sm text-slate-900 placeholder:text-slate-500 focus:outline-none"
            />
          </div>
          <button
            type="button"
            onClick={() => {
              setSelectedCountry("");
              setCustomCountry("");
            }}
            className="mt-2 text-xs font-semibold text-blue-700 hover:text-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300"
          >
            Choose from the country list
          </button>
        </div>
      )}
    </div>
  );
}
