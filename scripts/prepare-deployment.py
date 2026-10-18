"""Produce the single-file dashboard entry from the tested backend handler."""
from pathlib import Path

root = Path(__file__).resolve().parents[1]
handler = (root / 'supabase/functions/detective-access/handler.mjs').read_text()
handler = handler.replace('logger=console}) {', 'logger=console}: HandlerDependencies) {')
handler = handler.replace('const reply=(body,status=200)', 'const reply=(body: unknown,status=200)')
handler = handler.replace('return async request=>', 'return async (request: Request)=>')
handler = handler.replace('let orphan=null,admin;', 'let orphan: string | null=null,admin: ReturnType<typeof createClient> | undefined;')
types = """type HandlerDependencies = {
  createClient: typeof createClient;
  env: {get(name: string): string | undefined};
  crypto?: Crypto;
  logger?: Pick<Console, 'error' | 'warn'>;
};
"""
(root / 'supabase/detective-access-dashboard.ts').write_text(
    '// Paste this entire file into the detective-access Edge Function editor.\n'
    "import { createClient } from 'npm:@supabase/supabase-js@2.49.8';\n"
    + types + handler + '\nDeno.serve(createHandler({createClient, env:Deno.env}));\n'
)
print('Generated supabase/detective-access-dashboard.ts')
