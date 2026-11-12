"use client";

import { useState } from "react";
import { formatPhone } from "@/lib/phone";

type Contact = { first: string; last: string; cell: string; email: string };


const inputClass =
  "rounded-lg border border-border bg-surface px-3.5 py-2.5 text-sm text-ink outline-none focus:border-accent";

function ContactInputs({
  prefix,
  label,
  names,
  value,
  onChange,
  readOnly,
}: {
  prefix: string;
  label: string;
  names: Record<keyof Contact, string>;
  value: Contact;
  onChange: (next: Contact) => void;
  readOnly?: boolean;
}) {
  const field = (key: keyof Contact, title: string, type = "text") => {
    const isPhone = type === "tel";
    return (
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-ink">
          {`${prefix}'s ${title}`}
        </span>
        <input
          name={names[key]}
          type={type}
          required
          readOnly={readOnly}
          value={value[key]}
          onChange={(e) =>
            onChange({
              ...value,
              [key]: isPhone ? formatPhone(e.target.value) : e.target.value,
            })
          }
          {...(isPhone
            ? {
                inputMode: "numeric" as const,
                autoComplete: "tel-national",
                pattern: "\\d{3}-\\d{3}-\\d{4}",
                title: "Enter a 10-digit phone number, like 727-554-6666",
              }
            : {})}
          className={inputClass}
        />
      </label>
    );
  };

  return (
    <fieldset className="contents">
      <legend className="sr-only">{label}</legend>
      {field("first", "First Name")}
      {field("last", "Last Name")}
      {field("cell", "Cell Phone", "tel")}
      {field("email", "Email", "email")}
    </fieldset>
  );
}

// The decision maker's contact details. (The OTC Guru is just added as a
// teammate now, so there's no separate guru section.)
export function OwnerGuruFields({
  defaultOwner,
  heading = "Your Team\u2019s Decision Maker",
}: {
  defaultOwner: Contact;
  heading?: string;
}) {
  const [owner, setOwner] = useState({
    ...defaultOwner,
    cell: formatPhone(defaultOwner.cell),
  });

  return (
    <>
      <hr className="my-2 border-border sm:col-span-2" />
      <h2 className="text-[15px] font-bold text-ink sm:col-span-2">{heading}</h2>
      <ContactInputs
        prefix="Decision Maker"
        label="Decision Maker"
        names={{
          first: "first_name",
          last: "last_name",
          cell: "cell_phone",
          email: "email",
        }}
        value={owner}
        onChange={setOwner}
      />
    </>
  );
}
