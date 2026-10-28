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

export function OwnerGuruFields({
  defaultOwner,
  defaultGuru,
  defaultSame,
}: {
  defaultOwner: Contact;
  defaultGuru: Contact;
  defaultSame: boolean;
}) {
  const [owner, setOwner] = useState({
    ...defaultOwner,
    cell: formatPhone(defaultOwner.cell),
  });
  const [guru, setGuru] = useState({
    ...defaultGuru,
    cell: formatPhone(defaultGuru.cell),
  });
  const [same, setSame] = useState(defaultSame);

  return (
    <>
      <hr className="my-2 border-border sm:col-span-2" />
      <h2 className="text-[15px] font-bold text-ink sm:col-span-2">
        Your Team&rsquo;s Decision Maker
      </h2>
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

      <hr className="my-2 border-border sm:col-span-2" />
      <div className="flex flex-col gap-2 text-sm text-ink-soft sm:col-span-2">
        <h2 className="text-[15px] font-bold text-ink">
          Your Team&rsquo;s OTC Guru
        </h2>
        <p>
          The &ldquo;OTC Guru (in training)&rdquo; will most likely be someone
          who is in it for the long haul and is serious about the success of
          the business. They should have a vision for where OTC can take the
          business and be committed to the role as your team&rsquo;s go-to for
          all things OTC. They should have in-depth knowledge of real estate
          transactions, contract/state expertise, an understanding of the
          correspondence tied to each step, a keen eye for detail, and a deep
          understanding of your specific processes and workflows. The
          important piece is choosing someone who knows your processes like
          the back of their hand.
        </p>
        <p>
          Please note that an admin or assistant can help with the setup.
          Given that certain tasks are repetitive and will be prepared by the
          OTC Guru, you may opt to delegate some implementation
          responsibilities to an assistant or virtual assistant who can
          efficiently follow the step-by-step instructions provided in this
          course.
        </p>
      </div>
      <div className="sm:col-span-2">
        <label className="inline-flex items-center gap-2 text-sm text-ink">
          <input
            type="checkbox"
            name="guru_same_as_owner"
            checked={same}
            onChange={(e) => {
              setSame(e.target.checked);
              // Unchecking clears the copied details so the guru starts fresh.
              setGuru({ first: "", last: "", cell: "", email: "" });
            }}
            className="h-4 w-4"
          />
          OTC Guru is the same as Decision Maker
        </label>
      </div>
      <ContactInputs
        prefix="OTC Guru"
        label="OTC Guru"
        names={{
          first: "guru_first_name",
          last: "guru_last_name",
          cell: "guru_cell",
          email: "guru_email",
        }}
        value={same ? owner : guru}
        onChange={setGuru}
        readOnly={same}
      />
    </>
  );
}
