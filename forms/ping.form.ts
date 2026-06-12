import { Radio } from "lucide-react";
import { defineForm } from "@/lib/schema";

export default defineForm({
  slug: "ping",
  icon: Radio,
  title: "Ping",
  description: "Smoke test — proves the form → n8n webhook pipe works.",
  submitLabel: "Send ping",
  successMessage: "Ping delivered — check the n8n execution log.",
  pages: [
    {
      fields: [
        { type: "text", name: "message", label: "Message", placeholder: "hello n8n", required: true },
      ],
    },
  ],
  response: {
    title: "Webhook echo",
    fields: [
      { key: "body.message", label: "Message received" },
      { key: "executionMode", label: "Execution mode" },
      { key: "webhookUrl", label: "Endpoint" },
      { key: "headers.x-real-ip", label: "Client IP" },
    ],
  },
});
