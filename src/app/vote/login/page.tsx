import { loginWithQueueAndToken } from "./actions";

export default function VoteLoginPage() {
  return (
    <main className="mx-auto max-w-md p-6">
      <h1 className="text-2xl font-semibold">Voter Login</h1>
      <p className="mt-2 text-sm text-neutral-600">
        Enter your queue number and 6-digit token (from the QR code / Comelec personnel).
      </p>

      <form action={loginWithQueueAndToken} className="mt-6 space-y-4">
        <label className="block">
          <span className="text-sm font-medium">Queue Number</span>
          <input
            name="queue_number"
            inputMode="numeric"
            className="mt-1 w-full rounded-md border px-3 py-2"
            placeholder="e.g. 12"
            required
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium">6-digit Token</span>
          <input
            name="token"
            inputMode="numeric"
            pattern="\\d{6}"
            className="mt-1 w-full rounded-md border px-3 py-2 tracking-widest"
            placeholder="e.g. 123456"
            required
          />
        </label>

        <button
          type="submit"
          className="w-full rounded-md bg-black px-4 py-2 text-white"
        >
          Continue
        </button>
      </form>
    </main>
  );
}

