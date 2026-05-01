import { FitfoLoadingAnimation } from "@/components/FitfoLoadingAnimation";

export default function Loading() {
  return (
    <main className="flex min-h-screen flex-1 items-center justify-center px-6">
      <FitfoLoadingAnimation className="w-full max-w-44" />
    </main>
  );
}
