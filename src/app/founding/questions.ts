// The founding group application's qualifying questions (shared by the form
// and the staff list).
export const COMPANY_STRUCTURES = ["Real Estate Brokerage", "Real Estate Team", "Independent TC", "Team of TC's"];

// `notes`: a message shown under the question when that answer is picked.
export const QUESTIONS: {
  key: string;
  label: string;
  options?: string[];
  notes?: Record<string, string>;
  long?: boolean;
  required?: boolean;
}[] = [
  {
    key: "otc_status",
    label: "Where are you with Open to Close?",
    options: ["I haven't signed up yet", "I just signed up", "I'm on a trial", "I've already been using it"],
    notes: {
      "I haven't signed up yet":
        "Perfect! Wait until we launch so you can take full advantage of Open to Close's 30-day trial.",
      "I just signed up":
        "Delete your account and reach out to Open to Close to ask if they'll be able to restart your trial when you're ready.",
      "I'm on a trial":
        "Delete your account and reach out to Open to Close to ask if they'll be able to restart your trial when you're ready.",
      "I've already been using it":
        "This program requires a brand-new account. If you don't mind starting fresh, continue; otherwise, this program may not be beneficial at the moment.",
    },
    required: true,
  },
  {
    key: "launch_timeline",
    label: "When do you plan to launch Open to Close?",
    options: ["ASAP", "Within 2 weeks", "Within a month", "In 1 to 3 months"],
    required: true,
  },
  {
    key: "volume",
    label: "About how many transactions do you handle a year?",
    options: ["Under 50", "50 to 150", "150 to 500", "500 or more"],
    required: true,
  },
  {
    key: "users",
    label: "How many TCs and admins will use Open to Close?",
    options: ["Just me", "2 to 5", "6 to 15", "16 or more"],
    required: true,
  },
  {
    key: "commitment",
    label: "Can you set aside up to 5 hours a week for 4 weeks to complete your setup?",
    options: ["Yes", "I'm not sure"],
    required: true,
  },
  {
    key: "done_with_you",
    label: "Are you interested in the done-with-you spot for your group ($499 for 10 hours)?",
    options: ["Yes", "Maybe", "No, I'll set it up myself"],
    required: true,
  },
  {
    key: "challenge",
    label: "What's your biggest challenge with your current process or setup?",
    long: true,
    required: true,
  },
  { key: "referral", label: "How did you hear about the founding group?", required: true },
];
