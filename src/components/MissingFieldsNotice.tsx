"use client";

import { useEffect, useRef, useState } from "react";

const FIELDS = "input:invalid, select:invalid, textarea:invalid";

// After a blocked submit, marks the form so globals.css highlights every
// missing field, and says how many are left until they're all filled.
export function MissingFieldsNotice() {
  const ref = useRef<HTMLParagraphElement>(null);
  const [missing, setMissing] = useState(0);

  useEffect(() => {
    const form = ref.current?.closest("form");
    if (!form) return;

    const count = () => {
      if (form.dataset.attempted) {
        setMissing(form.querySelectorAll(FIELDS).length);
      }
    };
    // Fires on each invalid field when the browser blocks the submit.
    const onInvalid = () => {
      form.dataset.attempted = "true";
      count();
    };
    // Some values (the states list, copied guru details) are set by React
    // after the event, so recount once that render has landed.
    const onChange = () => window.setTimeout(count, 0);

    form.addEventListener("invalid", onInvalid, true);
    form.addEventListener("input", onChange);
    form.addEventListener("change", onChange);
    return () => {
      form.removeEventListener("invalid", onInvalid, true);
      form.removeEventListener("input", onChange);
      form.removeEventListener("change", onChange);
    };
  }, []);

  return (
    <p
      ref={ref}
      role="alert"
      className={`text-sm font-medium text-danger sm:col-span-2 ${missing ? "" : "hidden"}`}
    >
      {missing === 1
        ? "Please fill out the highlighted field."
        : `Please fill out the ${missing} highlighted fields.`}
    </p>
  );
}
