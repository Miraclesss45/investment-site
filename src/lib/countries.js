const fallbackCountries = [
  "Australia",
  "Brazil",
  "Canada",
  "France",
  "Germany",
  "Ghana",
  "India",
  "Ireland",
  "Italy",
  "Kenya",
  "Netherlands",
  "New Zealand",
  "Nigeria",
  "Portugal",
  "South Africa",
  "Spain",
  "United Arab Emirates",
  "United Kingdom",
  "United States",
];

export function getCountryOptions() {
  if (
    typeof Intl === "undefined" ||
    typeof Intl.DisplayNames !== "function" ||
    typeof Intl.supportedValuesOf !== "function"
  ) {
    return fallbackCountries;
  }

  try {
    const displayNames = new Intl.DisplayNames(["en"], { type: "region" });
    return Intl.supportedValuesOf("region")
      .map((code) => ({ code, name: displayNames.of(code) }))
      .filter(({ name }) => Boolean(name))
      .map(({ name }) => name)
      .sort((a, b) => a.localeCompare(b));
  } catch {
    return fallbackCountries;
  }
}

export const countryOptions = getCountryOptions();
