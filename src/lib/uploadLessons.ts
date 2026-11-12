// Setup Prep's upload lessons: they just upload their files here (CSV or
// Excel); matching columns comes later, in the matching Prep lesson.
export const UPLOAD_LESSONS = {
  contacts: {
    stepKey: "upload_your_contacts",
    page: "/configurator/upload_your_contacts",
    title: "Upload Your Contacts",
    noun: "contact list",
    blurb:
      "Upload your contact lists as CSV or Excel files (an export from your CRM, phone or email works). You'll match their columns in Prep Your Contacts.",
    // Contact lists can also be vCards or text exports.
    accept:
      ".csv,.tsv,.txt,.xlsx,.vcf,.vcard,text/csv,text/plain,text/vcard,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    formats: "CSV, Excel (.xlsx), vCard (.vcf) or a text export",
  },
  messages: {
    stepKey: "upload_your_messages",
    page: "/configurator/upload_your_messages",
    title: "Upload Your Messages",
    noun: "message file",
    blurb:
      "Upload the email and text templates you use today as CSV or Excel files. You'll match their columns in Prep Your Messages.",
    accept: ".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    formats: "CSV or Excel (.xlsx)",
  },
  tasks: {
    stepKey: "upload_your_tasks",
    page: "/configurator/upload_your_tasks",
    title: "Upload Your Tasks",
    noun: "task file",
    blurb:
      "Upload the task lists or checklists you use today as CSV or Excel files. You'll match their columns in Prep Your Tasks.",
    accept: ".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    formats: "CSV or Excel (.xlsx)",
  },
} as const;

export type UploadKind = keyof typeof UPLOAD_LESSONS;
