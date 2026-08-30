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
    // 帳票スクリプト（scripts/render_sample.mjs）の一時ビルド出力
    ".tmp-report-build/**",
    // 取込ドライラン（scripts/dry_run_import.mjs）の一時ビルド出力
    ".tmp-import-build/**",
  ]),
]);

export default eslintConfig;
