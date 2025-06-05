import { Loader } from "lucide-react";
import { lazy, Suspense } from "react";
const MainComponent = lazy(() => import("components/mainComponent"));
export default async function Home() {
  return (
    <main className="min-h-screen bg-white dark:bg-gray-950">
      <Suspense fallback={<Loader />}>
        <MainComponent />
      </Suspense>
    </main>
  );
}
