"use client";

import { useState } from "react";
import { CopyIcon } from "@/components/CopyButton";
import { BuiltCheckbox } from "@/components/NewFieldName";
import { setSetupCheck } from "@/app/configurator/_setup/actions";

type CheckProps = {
  // The client account (staff only; clients use their own).
  accountId: string | null;
  stepKey: string;
  checkKey: string;
  initialChecked: boolean;
};

function useCheck({ accountId, stepKey, checkKey, initialChecked }: CheckProps) {
  const [checked, setChecked] = useState(initialChecked);
  const mark = (next: boolean) => {
    setChecked(next);
    void setSetupCheck(accountId, stepKey, checkKey, next);
  };
  return [checked, mark] as const;
}

// A name to copy into Open to Close: a checkbox before it (checked when
// it's copied, or clicked), then the name and its copy icon.
export function CheckedCopyName({
  name,
  className = "font-semibold text-ink",
  ...props
}: CheckProps & { name: string; className?: string }) {
  const [checked, mark] = useCheck(props);
  return (
    <span className="inline-flex items-center gap-1.5 leading-none">
      <BuiltCheckbox built={checked} label={name} onToggle={() => mark(!checked)} />
      <span className={className}>{name}</span>
      <span onClickCapture={() => !checked && mark(true)}>
        <CopyIcon text={name} />
      </span>
    </span>
  );
}

// A checkbox they check by hand.
export function SetupCheckbox({ label, ...props }: CheckProps & { label: string }) {
  const [checked, mark] = useCheck(props);
  return <BuiltCheckbox built={checked} label={label} onToggle={() => mark(!checked)} />;
}
