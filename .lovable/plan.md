# Recreate the remaining Legacy Pro Alliance pages

## Scope
- Preserve the completed Home and About pages.
- Add dedicated routes for Our Packages, FAQ, Support, Sign Up, and Log In.
- Keep the public pages visually consistent with the existing Legacy Pro Alliance header, banner, content spacing, CTA, and footer.
- Reproduce the original site's distinct account-page styling for Sign Up and Log In rather than forcing the marketing-page layout onto them.

## Page implementation
- **Our Packages:** breadcrumb banner and four investment plan cards with the original percentages, deposit limits, 14-day duration, deposit-return details, and working Get Started links.
- **FAQ:** breadcrumb banner, four category tabs, and expandable questions for General, Deposits, Payouts, and Referrals.
- **Support:** breadcrumb banner, company contact details, and a validated assistance form. Submission stays presentational because no service is configured.
- **Sign Up:** dark account-registration page with paired identity, password, email, phone, country, and cryptocurrency wallet fields; terms agreement and client-side validation.
- **Log In:** focused welcome-back page with username/password fields, password visibility control, links to sign up and password reset, and client-side validation.

## Shared integration
- Update header, footer, Home buttons, feature links, and About links to use the new routes.
- Add a reusable inner-page banner and shared public-page CTA where the original site repeats them.
- Preserve responsive mobile navigation and ensure every navigation target has a real route.
- Give every new page unique title, description, Open Graph metadata, and Twitter card metadata.

## Validation
- Check every route on desktop and mobile.
- Verify navigation, tabs, accordions, password visibility, form validation, and asset loading.
- Confirm Home and About still render correctly with no browser errors.
