import type { AgDefaultWidgetDefinition } from "ag-studio";
import { createWidgets, type AgRegistry, type AgWidgetDefinition } from "ag-studio-react";
import { Scoreboard } from "./widgets/scoreboard";
import { StillToCome } from "./widgets/still-to-come";
import { VerdictPill } from "./widgets/verdict-pill";

// A custom widget = id + label + comp + dataMapping (which columns it needs) + form (the property panel) + sizes.
// `aiDescription` is what lets the Studio agent wire these widgets up unattended.
const verdictPill: AgWidgetDefinition = {
  id: "verdictPill",
  label: "Verdict pill",
  comp: VerdictPill,
  defaultSize: { width: 260, height: 140 },
  minSize: { width: 180, height: 110 },
  dataMapping: {
    reason: { type: "field", supportedRoles: ["category"], requires: { cardinality: "one" }, required: true, aiDescription: "The verdict reason code column, e.g. CONDITION_MET" },
  },
  form: () => [
    { type: "section", key: "data", label: "Data", defaultExpanded: true, items: [{ type: "field", id: "dataMapping.reason", label: "Reason", supportedRoles: ["category"], requires: { cardinality: "one" }, required: true }] },
  ],
  ai: { description: "Shows the reason code of the most recent verdict, colour-coded green / amber / red." },
};

const scoreboard: AgWidgetDefinition = {
  id: "scoreboard",
  label: "Promise scoreboard",
  comp: Scoreboard,
  defaultSize: { width: 340, height: 300 },
  minSize: { width: 240, height: 180 },
  dataMapping: {
    payer: { type: "field", supportedRoles: ["category"], requires: { cardinality: "one" }, required: true, aiDescription: "Who made the promise" },
    kind: { type: "field", supportedRoles: ["category"], requires: { cardinality: "one" }, required: true, aiDescription: "Verdict kind: met, unmet or indeterminate" },
  },
  form: () => [
    {
      type: "section", key: "data", label: "Data", defaultExpanded: true,
      items: [
        { type: "field", id: "dataMapping.payer", label: "Payer", supportedRoles: ["category"], requires: { cardinality: "one" }, required: true },
        { type: "field", id: "dataMapping.kind", label: "Verdict kind", supportedRoles: ["category"], requires: { cardinality: "one" }, required: true },
      ],
    },
  ],
  ai: { description: "A friendly scoreboard of who is on track, waiting, or missed their date. Not a collections report." },
};

const stillToCome: AgWidgetDefinition = {
  id: "stillToCome",
  label: "Still to come",
  comp: StillToCome,
  defaultSize: { width: 300, height: 280 },
  minSize: { width: 200, height: 160 },
  dataMapping: {
    customer: { type: "field", supportedRoles: ["category"], requires: { cardinality: "one" }, required: true, aiDescription: "Who the invoice is for (paypal source)" },
    amountMinor: { type: "field", supportedRoles: ["numeric"], requires: { cardinality: "one" }, required: true, aiDescription: "Invoice amount in minor units (paypal source)" },
    currency: { type: "field", supportedRoles: ["category"], requires: { cardinality: "one" }, required: true, aiDescription: "Invoice currency code (paypal source)" },
    status: { type: "field", supportedRoles: ["category"], requires: { cardinality: "one" }, required: true, aiDescription: "Invoice status, e.g. UNPAID (paypal source)" },
    dueAt: { type: "field", supportedRoles: ["temporal"], requires: { cardinality: "one" }, aiDescription: "Invoice due date (paypal source)" },
  },
  form: () => [
    {
      type: "section", key: "data", label: "Data", defaultExpanded: true,
      items: [
        { type: "field", id: "dataMapping.customer", label: "Customer", supportedRoles: ["category"], requires: { cardinality: "one" }, required: true },
        { type: "field", id: "dataMapping.amountMinor", label: "Amount (minor)", supportedRoles: ["numeric"], requires: { cardinality: "one" }, required: true },
        { type: "field", id: "dataMapping.currency", label: "Currency", supportedRoles: ["category"], requires: { cardinality: "one" }, required: true },
        { type: "field", id: "dataMapping.status", label: "Status", supportedRoles: ["category"], requires: { cardinality: "one" }, required: true },
        { type: "field", id: "dataMapping.dueAt", label: "Due date", supportedRoles: ["temporal"], requires: { cardinality: "one" } },
      ],
    },
  ],
  ai: { description: "Invoices still waiting on payment, in a friendly register. Empty state says 'Nothing waiting. All caught up.'" },
};

// The registry type is what makes `additionalTypes` legal: built-in widgets plus ours.
interface PromiseRegistry extends AgRegistry {
  widgets: readonly (AgDefaultWidgetDefinition | AgWidgetDefinition)[];
}

export const widgets = createWidgets<PromiseRegistry>({ additionalTypes: [verdictPill, scoreboard, stillToCome] });
