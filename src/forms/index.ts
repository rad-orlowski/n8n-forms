import type { FormSchema } from "@/lib/schema";
import contact from "./contact.form";
import bugReport from "./bug-report.form";
import ping from "./ping.form";

export const forms: FormSchema[] = [ping, contact, bugReport];

export function getForm(slug: string): FormSchema | undefined {
  return forms.find((f) => f.slug === slug);
}
