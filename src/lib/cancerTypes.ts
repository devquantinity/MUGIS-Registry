/** Short names for tight spaces (table cells); unknown codes fall back to the API's name. */
const SHORT: Record<string, string> = {
  GASTRIC_ADENO: "Gastric",
  OESOPHAGEAL_ADENO: "Oeso. adeno",
  OESOPHAGEAL_SCC: "Oeso. SCC",
  GIST: "GIST",
};

export function shortCancerType(code: string, name: string): string {
  return SHORT[code] ?? name;
}
