import { Suspense } from "react";

import { LoginForm } from "./LoginForm";

// Thin server-component wrapper so we get a Suspense boundary around the
// LoginForm — `useSearchParams()` inside LoginForm requires this in Next 16,
// and it also makes the static prerender pass clean.
export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
