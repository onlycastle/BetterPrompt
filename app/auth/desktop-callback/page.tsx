export default function DesktopCallbackPage() {
  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center">
        <div className="w-16 h-16 mx-auto mb-6 bg-zinc-800 rounded-full flex items-center justify-center">
          <span className="text-2xl">CLI</span>
        </div>
        <h1 className="text-xl font-semibold text-white mb-2">
          Desktop callback removed
        </h1>
        <p className="text-zinc-400 mb-4">
          The open-source build supports the self-hosted server and CLI flow only.
        </p>
        <p className="text-zinc-500 text-sm">
          Sign in through <code>/auth/device</code> or the web dashboard instead.
        </p>
      </div>
    </div>
  );
}
