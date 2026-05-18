export function parseInterestIdArg(argv: string[] = process.argv.slice(2)): string | null {
  const arg = argv.find((entry) => entry.startsWith("--interestId="));
  if (!arg) return null;
  const value = arg.split("=")[1]?.trim();
  return value ? value : null;
}
