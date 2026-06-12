import { MessageSquareHeart } from "lucide-react";
import { defineForm } from "@/lib/schema";

// Example form (committed, public). Showcases the rating + rich-text fields.
// Webhook is resolved server-side from WEBHOOK_FEEDBACK in the server's env.
export default defineForm({
  slug: "feedback",
  icon: MessageSquareHeart,
  title: "Share Feedback",
  description: "Tell us what's working and what isn't.",
  submitLabel: "Submit feedback",
  response: { header: { message: "Appreciated — every note gets read." } },
  pages: [
    {
      fields: [
        {
          type: "alert",
          variant: "info",
          label: "Heads up",
          content: "This form is an example. Wire it to your own n8n webhook to collect real responses.",
        },
        { type: "rating", name: "score", label: "Overall, how was your experience?", max: 5, required: true },
        {
          type: "select",
          name: "area",
          label: "Which area is this about?",
          options: [
            { label: "Onboarding", value: "onboarding" },
            { label: "Performance", value: "performance" },
            { label: "Documentation", value: "docs" },
            { label: "Something else", value: "other" },
          ],
        },
        {
          type: "richtext",
          name: "details",
          label: "Tell us more",
          description: "Formatting welcome — bold the parts that matter most.",
          required: true,
        },
        { type: "checkbox", name: "contactMe", label: "It's OK to follow up with me about this" },
      ],
    },
  ],
});
