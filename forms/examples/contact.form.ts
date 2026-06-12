import { Mail } from "lucide-react";
import { defineForm } from "@/lib/schema";

// Example form (committed, public). Real forms set the webhook from a local,
// gitignored .env via import.meta.env.VITE_WEBHOOK_<SLUG>. The matching
// placeholder key lives in .env.example.
export default defineForm({
  slug: "contact",
  icon: Mail,
  title: "Contact Us",
  description: "Drop us a line and we'll get back to you.",
  webhook: import.meta.env.VITE_WEBHOOK_CONTACT,
  submitLabel: "Send message",
  successMessage: "Thanks — your message is on its way.",
  fields: [
    { type: "text", name: "name", label: "Your name", placeholder: "Ada Lovelace", required: true },
    { type: "email", name: "email", label: "Email", placeholder: "ada@example.com", required: true },
    {
      type: "select",
      name: "topic",
      label: "What's this about?",
      required: true,
      options: [
        { label: "General enquiry", value: "general" },
        { label: "Sales", value: "sales" },
        { label: "Technical support", value: "support" },
        { label: "Partnerships", value: "partnerships" },
      ],
    },
    {
      type: "textarea",
      name: "message",
      label: "Message",
      placeholder: "How can we help?",
      required: true,
    },
    { type: "checkbox", name: "subscribe", label: "Subscribe me to the monthly newsletter" },
  ],
});
