/** Minimal Supabase Edge Runtime declarations for local TypeScript tooling. */
declare namespace Deno {
  namespace env {
    function get(key: string): string | undefined
  }

  function serve(handler: (request: Request) => Response | Promise<Response>): void
}
