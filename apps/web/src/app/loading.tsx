import { FitfoLoadingAnimation } from "@/components/FitfoLoadingAnimation";

export default function Loading() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-bg px-6">
      <FitfoLoadingAnimation className="w-full max-w-44" />
    </main>
  );
}
