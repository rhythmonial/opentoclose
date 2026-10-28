"use client";

import { useEffect, useRef, useState } from "react";

// Shows its children once every named field in the surrounding form has a
// valid value. While hidden, the group is disabled so its required fields
// don't block submit and nothing in it is posted.
export function RevealWhenFilled({
  fields,
  initiallyShown,
  children,
}: {
  fields: string[];
  initiallyShown: boolean;
  children: React.ReactNode;
}) {
  const [shown, setShown] = useState(initiallyShown);
  const ref = useRef<HTMLFieldSetElement>(null);
  const fieldKey = fields.join(",");

  useEffect(() => {
    const form = ref.current?.form ?? ref.current?.closest("form");
    if (!form) return;
    const names = fieldKey.split(",");

    const check = () => {
      setShown(
        names.every((name) => {
          const el = form.elements.namedItem(name);
          return (
            el instanceof HTMLInputElement &&
            el.value.trim() !== "" &&
            (el.type !== "email" || el.validity.valid)
          );
        }),
      );
    };
    // Some gating values (the copied guru email, the states list) are set by
    // React after the event, so check once that render has landed.
    const onChange = () => window.setTimeout(check, 0);

    form.addEventListener("input", onChange);
    form.addEventListener("change", onChange);
    return () => {
      form.removeEventListener("input", onChange);
      form.removeEventListener("change", onChange);
    };
  }, [fieldKey]);

  return (
    <fieldset ref={ref} disabled={!shown} className={shown ? "contents" : "hidden"}>
      {children}
    </fieldset>
  );
}
