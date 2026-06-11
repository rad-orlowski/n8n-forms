import { defineForm } from "@/lib/schema";

export default defineForm({
  slug: "contact",
  title: "Contact",
  description: "General enquiries, routed into the contact workflow.",
  webhook: import.meta.env.VITE_WEBHOOK_CONTACT,
  submitLabel: "Send message",
  successMessage: "Thanks — your message was handed off to n8n.",
  fields: [
    {
      type: "text",
      name: "name",
      label: "Name",
      placeholder: "Ada Lovelace",
      required: true,
    },
    {
      type: "email",
      name: "email",
      label: "Email",
      required: true,
    },
    {
      type: "select",
      name: "topic",
      label: "Topic",
      placeholder: "What's this about?",
      required: true,
      options: [
        { label: "General question", value: "general" },
        { label: "Partnership", value: "partnership" },
        { label: "Something else", value: "other" },
      ],
    },
    {
      type: "richtext",
      name: "message",
      label: "Message",
      description: "Formatting is preserved — sent to the webhook as HTML.",
      required: true,
    },
    {
      type: "checkbox",
      name: "subscribe",
      label: "Keep me in the loop",
      description: "Occasional updates, no spam.",
    },
  ],
});
