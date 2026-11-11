// The founding group application's qualifying questions (shared by the form
// and the staff list).
export const COMPANY_STRUCTURES = ["Real Estate Brokerage", "Real Estate Team", "Independent TC", "Team of TC's"];

export const QUESTIONS: { key: string; label: string; options?: string[]; long?: boolean; required?: boolean }[] = [
  {
    key: "otc_status",
    label: "Where are you with Open to Close?",
    options: [
      "I haven't purchased it yet",
      "I just purchased a new account",
      "I'm on a trial",
      "I've already been using it",
    ],
    required: true,
  },
  {
    key: "launch_timeline",
    label: "When do you plan to launch Open to Close?",
    options: ["Within 2 weeks", "Within a month", "In 1 to 3 months", "Not sure yet"],
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
    label: "How many people will use Open to Close?",
    options: ["Just me", "2 to 5", "6 to 15", "16 or more"],
    required: true,
  },
  {
    key: "contracts_ready",
    label: "Do you have blank copies of your contracts and addenda?",
    options: ["Yes, all of them", "Some of them", "Not yet"],
    required: true,
  },
  {
    key: "commitment",
    label: "Can you set aside time each week for 4 weeks to complete your setup?",
    options: ["Yes", "I'm not sure"],
    required: true,
  },
  {
    key: "done_with_you",
    label: "Are you interested in the done-with-you spot ($499 for 10 hours)?",
    options: ["Yes", "Maybe", "No, I'll set it up myself"],
    required: true,
  },
  {
    key: "challenge",
    label: "What's your biggest challenge with your current process or setup?",
    long: true,
  },
  { key: "referral", label: "How did you hear about the founding group?" },
];
