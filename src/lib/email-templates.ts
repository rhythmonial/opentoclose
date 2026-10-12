// Not wired to a sender yet (no transactional email provider connected).
// Drafted so the copy is ready to go once one is picked.

export function requestInfoEmail({ name }: { name: string }) {
  return {
    subject: "OTC Setup — pricing & what setup looks like",
    body: `Hi ${name},

Thanks for your interest in Open to Close setup.

One important note: anyone on the team can request info, but the account
itself has to be created and paid for by the broker/team owner — that's
who we set up and bill directly. Once the owner signs up, they can invite
admins (like you, if you're not the owner) from their Profile page to help
run day-to-day setup.

Here's what setup looks like:
1. The owner signs up and chooses a setup path (Custom or Express).
2. We send a short set of prep sheets covering your workflow fields,
   contacts & roles, document templates, and date rules.
3. The owner (or an admin they've invited) fills those out at their own
   pace, with sample templates to start from.
4. We review what's submitted and build it into your OTC account.
5. Kickoff call, then you're live.

Pricing:
- Custom Setup — $999, up to 10 hours of setup support
- OTC Express — $777 flat, a faster guided path

Reply to this email any time with questions — happy to walk through
whichever path fits best.`,
  };
}
