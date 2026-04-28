import { FitFoLoadingAnimation } from "@/components/FitFoLoadingAnimation";

export default function Loading() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-bg px-6">
      <FitFoLoadingAnimation className="w-full max-w-44" />
    </main>
  );
}
