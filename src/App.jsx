import { lazy, Suspense } from "react";
import BrandLoader from "./components/ui/BrandLoader";

const AppShell = lazy(() => import("./AppShell"));

export default function App() {
  return (
    <Suspense
      fallback={
        <BrandLoader />
      }
    >
      <AppShell />
    </Suspense>
  );
}
