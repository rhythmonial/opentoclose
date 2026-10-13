export function stepClientHref(step: {
  id: string;
  key: string;
  step_type: string;
  link_url?: string | null;
}): string {
  if (step.key === "setup_initiation") return "/setup";
  if (step.step_type === "configurator") return `/configurator/${step.key}`;
  if (
    (step.step_type === "form" || step.step_type === "link") &&
    step.link_url
  ) {
    return step.link_url;
  }
  return `/lesson/${step.id}`;
}

export function isExternalStepLink(step: {
  step_type: string;
  link_url?: string | null;
}): boolean {
  return (
    (step.step_type === "form" || step.step_type === "link") &&
    Boolean(step.link_url)
  );
}
