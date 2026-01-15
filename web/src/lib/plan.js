export function isPro() {
  try {
    return localStorage.getItem("jp_plan") === "pro";
  } catch {
    return false;
  }
}
