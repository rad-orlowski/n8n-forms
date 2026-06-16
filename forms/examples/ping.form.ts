import { defineForm } from "@/lib/schema";

export default defineForm({
  slug: "ping",
  icon: "Radio",
  title: "Ping",
  description: "Smoke test — proves the form → n8n webhook pipe works.",
  submitLabel: "Send ping",
  pages: [
    {
      fields: [
        {
          type: "text",
          name: "message",
          label: "Message",
          placeholder: "hello n8n",
          required: true,
        },
      ],
    },
  ],
  response: {
    header: {
      message: "Ping delivered — check the n8n execution log.",
      title: "Webhook echo",
    },
    fields: [
      { key: "body.answers.message", label: "Message received" },
      { key: "executionMode", label: "Execution mode" },
      { key: "webhookUrl", label: "Endpoint" },
      { key: "headers.x-real-ip", label: "Client IP" },
    ],
  },
});
