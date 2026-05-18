import { Suspense } from "react";
import { LoginForm } from "@/components/auth/login-form";

export default function LoginPage() {
  return (
    <main className="grid min-h-svh grid-cols-1 bg-background lg:grid-cols-[1.1fr_0.9fr]">
      <section className="flex items-center px-6 py-10 sm:px-10 lg:px-16">
        <div className="w-full max-w-md">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">
            Furniture Odyssey
          </p>
          <h1 className="mt-4 text-4xl font-semibold tracking-normal text-foreground">
            Internal operations login
          </h1>
          <p className="mt-4 text-sm leading-6 text-muted-foreground">
            Access is limited to invited Admin and Staff accounts.
          </p>
          <div className="mt-8 rounded-lg border border-border bg-panel p-5">
            <Suspense>
              <LoginForm />
            </Suspense>
          </div>
        </div>
      </section>
      <section className="hidden bg-[linear-gradient(135deg,rgba(18,112,104,0.94),rgba(37,43,47,0.98)),url('https://images.unsplash.com/photo-1555041469-a586c61ea9bc?auto=format&fit=crop&w=1400&q=80')] bg-cover bg-center lg:block" />
    </main>
  );
}
