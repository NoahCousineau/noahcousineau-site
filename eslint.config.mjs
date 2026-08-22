import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Git worktrees Claude Code creates for background tasks carry their own
    // .next build output. Those are generated bundles, not source, and
    // linting them buried the real result: 622 errors and 10,233 warnings,
    // none of them from this project's code. The patterns above only match
    // at the root, so they don't catch a nested copy.
    ".claude/**",
    "**/.next/**",
  ]),
]);

export default eslintConfig;
