// Moved to src/components/FitText.tsx (shared — project pages reuse it too,
// so the project "statement" block can guarantee it never overflows, exactly
// like the homepage Description block). Re-exported here so existing
// homepage imports (`from "./FitText"`) keep working.
export { FitText } from "@/components/FitText";
