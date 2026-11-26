// The OTC Audit checklist: what Josie fills in while auditing an account
// (steps, sections and items), and for each item what the report says.
// Values are saved in the report's `checklist` (item key -> value; an
// item's extra box is saved as `<key>__detail`).

export type ChecklistItem =
  | { key: string; type: "text" | "textarea"; label: string; placeholder?: string; report?: string }
  | { key: string; type: "select"; label: string; options: string[] }
  | { key: string; type: "multiselect"; label: string; options: string[] }
  // Lists every option in the report, checked where selected.
  | { key: string; type: "checklist"; label: string; options: string[] }
  | { key: string; type: "number"; label: string; percent?: boolean }
  // A box to tick. `report` is the recommendation when it's ticked;
  // `detail` is an extra box that appears when it's ticked ({{detail}} in
  // the report is what's typed there).
  | {
      key: string;
      type: "check";
      label: string;
      report?: string;
      detail?: { type: "text" | "textarea" | "multiselect"; label: string; options?: string[] };
    }
  | { key: string; type: "yesno"; label: string; reportYes: string; reportNo: string }
  // A checkbox the report always speaks to: one thing when it's ticked,
  // another when it isn't.
  | { key: string; type: "toggle"; label: string; reportOn: string; reportOff: string }
  // The fields filled in on their contract, found by scanning it (one per
  // line, to review and put in order); the report lists them.
  | { key: string; type: "contract_fields"; label: string; report: string }
  // Paste template names (one per line); the duplicates are listed.
  | { key: string; type: "duplicates"; label: string; report: string };

export type ChecklistSection = { title?: string; items: ChecklistItem[] };
export type ChecklistStep = { key: string; title: string; sections: ChecklistSection[] };

const MERGE_FORMATS = [
  "{{merge_field}}",
  "{{merge-field}}",
  "{{merge field}}",
  "[[merge_field]]",
  "[[merge-field]]",
  "[[merge field]]",
  "%merge_field%",
  "%merge-field%",
  "%merge field%",
];

const PLANS = ["Lite ($9)", "Plus ($49)", "Premium ($69)", "Premium+ ($99)", "Grow ($99)", "Pro ($199)", "Scale ($399)"];

const CATEGORY_TIP =
  "Start each category name with 00, 01, 02, 03 and so on, so the categories appear in the order you want them.";

// The template checks shared by email, task and text templates.
function templateBasics(prefix: string, kind: string, findBy: string): ChecklistItem[] {
  return [
    {
      key: `${prefix}_no_categories`,
      type: "check",
      label: "No categories",
      report: `Categorize your ${kind} templates by type (for example General, Inspection, Loan, HOA). ${CATEGORY_TIP}`,
    },
    {
      key: `${prefix}_missing_prefix`,
      type: "check",
      label: "Template titles missing prefix",
      report: `Add a prefix to the front of each ${kind} template title: B (buyer), S (seller), L (listing), and any other client types you use. This makes it easier to find ${findBy}.`,
    },
    {
      key: `${prefix}_unorganized`,
      type: "check",
      label: "Templates unorganized",
      report: `Organize your ${kind} templates by prefix, then by category.`,
    },
    {
      key: `${prefix}_duplicates`,
      type: "duplicates",
      label: "Templates have duplicates (paste the template names, one per line)",
      report: `These ${kind} templates appear more than once. Keep one of each and delete the rest:`,
    },
  ];
}

function mergeCleanup(prefix: string, kind: string): ChecklistItem {
  return {
    key: `${prefix}_needs_cleaning`,
    type: "check",
    label: "Templates need cleaning",
    report: `Some ${kind} templates have merge fields written in these formats: {{detail}}. Clean them up so every template uses the same merge field format and fills in correctly.`,
    detail: { type: "multiselect", label: "Merge field formats found", options: MERGE_FORMATS },
  };
}

export const AUDIT_CHECKLIST: ChecklistStep[] = [
  {
    key: "account",
    title: "Account Details",
    sections: [
      {
        title: "Profile",
        items: [{ key: "missing_contact_info", type: "textarea", label: "Missing contact info" }],
      },
      {
        title: "Billing",
        items: [
          { key: "current_plan", type: "select", label: "Current plan", options: PLANS },
          { key: "recommended_plan", type: "select", label: "Recommended plan", options: PLANS },
        ],
      },
      {
        title: "Organization",
        items: [
          { key: "team_members", type: "number", label: "Team members" },
          {
            key: "teams_improvements",
            type: "check",
            label: "Teams can use improvements",
            report: "{{detail}}",
            detail: { type: "textarea", label: "Your team recommendations" },
          },
        ],
      },
    ],
  },
  {
    key: "health",
    title: "Run Account Health Analysis",
    sections: [
      {
        items: [
          { key: "health_score", type: "number", label: "Health score", percent: true },
          { key: "health_status", type: "select", label: "Health status", options: ["Cluttered"] },
          { key: "open_properties", type: "number", label: "Open properties" },
          { key: "open_triggers", type: "number", label: "Open triggers" },
          { key: "open_tasks", type: "number", label: "Open tasks" },
          { key: "cleanup_count", type: "number", label: "Things to clean up" },
        ],
      },
    ],
  },
  {
    key: "views",
    title: "Views",
    sections: [
      {
        items: [
          { key: "view_properties", type: "textarea", label: "Properties view" },
          { key: "view_tasks", type: "textarea", label: "Tasks view" },
          { key: "view_triggers", type: "textarea", label: "Triggers view" },
          { key: "view_submissions", type: "textarea", label: "Submissions view" },
          { key: "view_dates", type: "textarea", label: "Dates view" },
          { key: "view_contacts", type: "textarea", label: "Contacts view" },
          { key: "view_reports", type: "textarea", label: "Reports view" },
        ],
      },
    ],
  },
  {
    key: "integrations",
    title: "Integrations",
    sections: [
      {
        items: [
          {
            key: "integrations",
            type: "checklist",
            label: "Current integrations",
            options: ["Google", "Microsoft", "Dotloop", "Stripe", "Follow Up Boss", "SkySlope", "Brokermint", "DocuSign"],
          },
        ],
      },
    ],
  },
  {
    key: "settings",
    title: "Global Settings",
    sections: [
      {
        title: "Settings",
        items: [
          {
            key: "timezone",
            type: "select",
            label: "Timezone",
            options: ["HST", "AKDT", "PDT", "MST", "MDT", "CST", "CDT", "EDT", "ADT", "Canada 05"],
          },
          { key: "email_address", type: "select", label: "Email address", options: ["Google", "Microsoft", "Non-API"] },
          {
            key: "email_signature_inaccurate",
            type: "check",
            label: "Email signature default is inaccurate",
            report:
              "Create a new email signature with {{detail}}'s body, and rename the current one to \"Default Email Signature\".",
            detail: { type: "text", label: "Defaulted email signature name" },
          },
          {
            key: "phone_numbers_active",
            type: "check",
            label: "Phone numbers active",
            report:
              "Add a sentence to every text template sent to agents saying \"Please do not reply.\" Texts are best for outgoing messages only: incoming messages won't attach to a specific property, which creates confusion and extra back-and-forth to figure out which property an agent meant.",
          },
          {
            key: "health_bar_hidden",
            type: "check",
            label: "Property table's health bar is hidden",
            report:
              "Show the health bar on the property table. The goal is to work directly from the property table instead of jumping in and out of transactions to complete tasks, send emails and manage documents.",
          },
          {
            key: "contact_roles_unorganized",
            type: "check",
            label: "Contact roles are unorganized",
            report:
              "Organize your contact roles with the primary parties to the transaction first, then the remaining contacts in alphabetical order.",
          },
          {
            key: "contact_role_recommendations",
            type: "check",
            label: "Contact role recommendations",
            report: "{{detail}}",
            detail: { type: "textarea", label: "Your contact role recommendations" },
          },
          {
            key: "documents_trigger_file_role",
            type: "toggle",
            label: "Documents trigger file role is yes",
            reportOn:
              "Documents trigger file role is set to yes. It's best to use this only if documents are not being added to Open to Close.",
            reportOff:
              "Documents trigger file role is set to no. It's best to use this only if documents are always being added to Open to Close.",
          },
          {
            key: "broker_signed_button",
            type: "check",
            label: "Broker signed button",
            report: "Remove the Broker Signed button, and create a custom button only if it's truly necessary.",
          },
          {
            key: "file_sorting_alphabetical",
            type: "check",
            label: "File sorting is alphabetical (not user order)",
            report: "Change file sorting from alphabetical to user sorted.",
          },
          {
            key: "file_role_recommendations",
            type: "check",
            label: "File role recommendations",
            report: "{{detail}}",
            detail: { type: "textarea", label: "Your file role recommendations" },
          },
          {
            key: "intake_validation_disabled",
            type: "check",
            label: "Intake form stage validation disabled",
            report:
              "Enable intake form stage validation so important contract details aren't missed, and so your form triggers and conditions work as intended.",
          },
        ],
      },
    ],
  },
  {
    key: "fields",
    title: "Fields",
    sections: [
      {
        title: "Field Groups",
        items: [
          {
            key: "address_group",
            type: "check",
            label: "Address field group present",
            report:
              "Move the Address field group's fields into the Transaction field group. It cleans up your field groups and saves jumping from group to group for information.",
          },
          {
            key: "commission_group",
            type: "check",
            label: "Commission field group present",
            report:
              "Archive the commission fields you don't need, and move the ones you do into the appropriate groups (for example, Commission and Referral).",
          },
        ],
      },
      {
        title: "Transaction Fields",
        items: [
          {
            key: "tx_fields_multiple_groups",
            type: "check",
            label: "Transaction fields are in multiple field groups",
            report: "Move and organize all of your transaction fields into the Transaction Details field group.",
          },
          {
            key: "hidden_fields_unarchived",
            type: "check",
            label: "Hidden field sections and fields unarchived",
            report: "Move hidden fields and field sections into an Archived field group or section.",
          },
          {
            key: "year_built_field",
            type: "check",
            label: "Year built field",
            report:
              "If lead-based paint is the only reason you enter the year built, replace it with a Lead-Based Paint Yes/No choice field. It saves time entering data you don't need.",
          },
          {
            key: "days_fields_not_bottom",
            type: "check",
            label: "Days fields are not at the bottom",
            report: "Move the due days fields to the bottom of their field sections, so the important fields stay at the top.",
          },
          {
            key: "text_areas_not_bottom",
            type: "check",
            label: "Text areas not below due days or at the bottom",
            report:
              "Move text area fields to the bottom of their field sections, below the due days. They're larger boxes and leave an unnecessary gap in your field sections.",
          },
        ],
      },
      {
        title: "Field Order",
        items: [
          {
            key: "field_order",
            type: "contract_fields",
            label: "Fields filled in on their contract",
            report: "Based on your contract, here's the order we recommend for your fields:",
          },
        ],
      },
    ],
  },
  {
    key: "templates",
    title: "Templates",
    sections: [
      {
        title: "Email Templates",
        items: [
          ...templateBasics("email", "email", "email templates that have the correct To, CC and BCC contact roles"),
          mergeCleanup("email", "email"),
          { key: "email_other", type: "textarea", label: "Other email template suggestions" },
        ],
      },
      {
        title: "Task Templates",
        items: [
          ...templateBasics("task", "task", "task templates that have the correct email templates"),
          {
            key: "task_needs_cleaning",
            type: "check",
            label: "Templates need cleaning",
            report:
              "Break your task templates up into categories (for example General, Inspection, Loan, HOA) so you can assign and trigger tasks on the transactions they actually apply to.",
          },
          {
            key: "task_missing_triggers",
            type: "check",
            label: "Tasks are missing triggers",
            report:
              "Scan your tasks for any missing triggers, then create task triggers and assign email templates, so sending an email isn't an extra manual step from the transaction.",
          },
          {
            key: "task_missing_due_dates",
            type: "check",
            label: "Tasks are missing due dates",
            report:
              "Scan your tasks for any missing a due date and assign one, so tasks don't sit in \"Unscheduled\" within the transaction.",
          },
          {
            key: "task_no_critical",
            type: "check",
            label: "No critical tasks",
            report:
              "Mark the tasks you should complete first thing in the morning on the days they're due as critical, so important deadline emails, reminders and other information go out before less critical tasks and emails.",
          },
          {
            key: "task_no_child",
            type: "check",
            label: "No child tasks",
            report:
              "Read through your tasks and due dates to see where a process would work better as a parent and child task instead of a due date.\n\nFor example: {{detail}}",
            detail: { type: "text", label: "Task template and task name(s) where a child task would help" },
          },
          { key: "task_other", type: "textarea", label: "Other task template suggestions" },
        ],
      },
      {
        title: "Document Templates",
        items: [
          {
            key: "doc_no_categories",
            type: "check",
            label: "No categories",
            report: `Categorize your document templates by client type (for example Transaction, Buyer, Seller, Listing). ${CATEGORY_TIP}`,
          },
          {
            key: "doc_missing_prefix",
            type: "check",
            label: "Template titles missing prefix",
            report:
              "Add a prefix to the front of each document template title: G (general), T (transaction), B (buyer), S (seller), L (listing), and any other client types you use. This makes them easier to find.",
          },
          {
            key: "doc_unorganized",
            type: "check",
            label: "Templates unorganized",
            report: "Organize your document templates by prefix, then by most used.",
          },
          {
            key: "doc_duplicates",
            type: "duplicates",
            label: "Templates have duplicates (paste the template names, one per line)",
            report: "These document templates appear more than once. Keep one of each and delete the rest:",
          },
          {
            key: "doc_needs_cleaning",
            type: "check",
            label: "Templates need cleaning",
            report:
              "Break your document templates up into categories (for example General, Inspection, Loan, HOA) so you can assign and trigger them on the transactions they actually apply to.",
          },
          {
            key: "doc_missing_file_roles",
            type: "check",
            label: "Docs are missing file roles",
            report:
              "Scan your documents for any missing file roles and create or assign them, so attaching documents to email templates isn't an extra step when sending emails from the transaction. Once file roles are assigned, go through your email templates and attach documents to the emails that should include them.",
          },
          {
            key: "doc_no_excluded",
            type: "check",
            label: "No excluded docs",
            report:
              "Mark internal documents with EX where needed, so agent and client portals don't expose them.",
          },
          { key: "doc_other", type: "textarea", label: "Other document template suggestions" },
        ],
      },
      {
        title: "Date Templates",
        items: [
          {
            key: "date_multiple",
            type: "check",
            label: "Multiple date templates",
            report:
              "Clean up your date templates. Only one date template can be applied to a transaction at a time, so you shouldn't need many. The only time you'd use more than a Pending or Listing template is for construction, land or compliance-only deals, where fewer or different dates need to calculate automatically.",
          },
          { key: "date_other", type: "textarea", label: "Other date template suggestions" },
        ],
      },
      {
        title: "Field Templates",
        items: [
          {
            key: "field_templates_used",
            type: "check",
            label: "There are field templates",
            report:
              "Move away from field templates and create intake form triggers to apply the right fields instead. No two transactions are the same, and applying one field template across many transactions leaves you missing important information or adding fields you don't need.",
          },
          { key: "field_other", type: "textarea", label: "Other field template suggestions" },
        ],
      },
      {
        title: "Text Templates",
        items: [
          ...templateBasics("text", "text", "text templates that go to the correct contact roles"),
          mergeCleanup("text", "text"),
          { key: "text_other", type: "textarea", label: "Other text template suggestions" },
        ],
      },
    ],
  },
];

export type ChecklistValues = Record<string, string | boolean | string[]>;

// Template names that appear more than once (ignoring case and spacing),
// each listed once in the form first seen.
export function duplicateNames(text: string): string[] {
  const seen = new Map<string, { name: string; count: number }>();
  for (const line of text.split("\n")) {
    const name = line.replace(/\s+/g, " ").trim();
    if (!name) continue;
    const k = name.toLowerCase();
    const e = seen.get(k);
    if (e) e.count++;
    else seen.set(k, { name, count: 1 });
  }
  return [...seen.values()].filter((e) => e.count > 1).map((e) => `${e.name} (${e.count}x)`);
}

// 1234567 -> "1,234,567" (digits only kept).
export const withCommas = (v: string) => {
  const digits = v.replace(/\D/g, "").replace(/^0+(?=\d)/, "");
  return digits ? Number(digits).toLocaleString("en-US") : "";
};

const ITEM_KEYS = new Set(
  AUDIT_CHECKLIST.flatMap((s) => s.sections.flatMap((sec) => sec.items.flatMap((i) => [i.key, `${i.key}__detail`]))),
);

export function cleanChecklist(raw: unknown): ChecklistValues {
  const out: ChecklistValues = {};
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!ITEM_KEYS.has(k)) continue;
    if (k === "documents_trigger_file_role" && typeof v === "string") out[k] = v === "yes";
    else if (typeof v === "boolean") out[k] = v;
    else if (typeof v === "string") out[k] = v.replace(/\r\n/g, "\n").slice(0, 20000);
    else if (Array.isArray(v)) out[k] = v.filter((x): x is string => typeof x === "string").slice(0, 50).map((x) => x.slice(0, 200));
  }
  return out;
}
