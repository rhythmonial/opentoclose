export function stepClientHref(step: {
  id: string;
  key: string;
  step_type: string;
}): string {
  if (step.key === "setup_initiation") return "/setup";
  if (step.step_type === "configurator") return `/configurator/${step.key}`;
  return `/lesson/${step.id}`;
}
