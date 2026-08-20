"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

function PasswordForm() {
  const [pass, setPass] = useState("");
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const params = useSearchParams();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(false);
    try {
      const res = await fetch("/api/unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pass }),
      });
      if (res.ok) {
        const from = params.get("from");
        router.replace(from && from.startsWith("/work") ? from : "/work");
        router.refresh();
      } else {
        setError(true);
        setBusy(false);
      }
    } catch {
      setError(true);
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col items-center gap-5 w-full max-w-xs">
      <input
        type="password"
        value={pass}
        onChange={(e) => setPass(e.target.value)}
        autoFocus
        placeholder="••••••"
        className="w-full bg-transparent border-b-2 border-[color:var(--color-ink)] py-3 text-center text-xl outline-none placeholder:opacity-30"
        aria-label="Password"
      />
      {error && (
        <p className="text-[color:var(--color-accent)] text-sm">Incorrect password.</p>
      )}
      <button
        type="submit"
        disabled={busy || !pass}
        className="uppercase tracking-widest border border-[color:var(--color-ink)] px-8 py-3 transition-opacity hover:opacity-60 disabled:opacity-30"
        style={{ fontSize: "var(--text-caption)" }}
      >
        {busy ? "…" : "Enter"}
      </button>
    </form>
  );
}

export default function PasswordPage() {
  return (
    <main className="min-h-[100svh] flex flex-col items-center justify-center px-(--gutter) text-center">
      <p
        className="uppercase tracking-widest text-[color:var(--color-muted)] mb-6"
        style={{ fontSize: "var(--text-caption)" }}
      >
        Protected
      </p>
      <h1
        className="uppercase leading-[0.85] tracking-tight mb-10"
        style={{ fontSize: "var(--text-title)" }}
      >
        Enter Password
      </h1>

      <Suspense fallback={null}>
        <PasswordForm />
      </Suspense>

      <Link
        href="/"
        className="mt-12 uppercase tracking-widest underline underline-offset-4 hover:opacity-60 transition-opacity"
        style={{ fontSize: "var(--text-caption)" }}
      >
        ← Back to home
      </Link>
    </main>
  );
}
