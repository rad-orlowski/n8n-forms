import { defineForm } from "@/lib/schema";

export default defineForm({
  slug: "bug-report",
  title: "Bug report",
  description: "File an issue straight into the triage workflow.",
  webhook: import.meta.env.VITE_WEBHOOK_BUG_REPORT,
  submitLabel: "File report",
  successMessage: "Logged. The triage workflow has it from here.",
  fields: [
    {
      type: "text",
      name: "summary",
      label: "Summary",
      placeholder: "One-line description",
      required: true,
    },
    {
      type: "select",
      name: "severity",
      label: "Severity",
      placeholder: "How bad is it?",
      required: true,
      options: [
        { label: "Blocker", value: "blocker" },
        { label: "Major", value: "major" },
        { label: "Minor", value: "minor" },
        { label: "Cosmetic", value: "cosmetic" },
      ],
    },
    {
      type: "rating",
      name: "impact",
      label: "Impact",
      description: "How many users does this hit, roughly?",
      max: 5,
    },
    {
      type: "richtext",
      name: "details",
      label: "Steps to reproduce",
      description: "Use a numbered list — sent as HTML.",
      required: true,
    },
    {
      type: "date",
      name: "noticed_on",
      label: "First noticed",
    },
    {
      type: "checkbox",
      name: "reproducible",
      label: "Consistently reproducible",
    },
  ],
});
