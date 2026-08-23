import coreWebVitals from "eslint-config-next/core-web-vitals";
import typescript from "eslint-config-next/typescript";

// eslint-config-next 16 ships a native flat config, so the FlatCompat bridge
// that create-next-app generated is no longer needed (and crashes against it).
// Each subpath is a CommonJS module whose default export is a config array.
const eslintConfig = [
  ...coreWebVitals,
  ...typescript,
  {
    ignores: [".next/**", "node_modules/**", "next-env.d.ts"],
  },
];

export default eslintConfig;
