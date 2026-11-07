import { DEMO_OFFERS, DEMO_OPERATORS, type Order } from "@kalea/shared";

// In-memory store; replace with a database (e.g. Postgres/D1) before the pilot.
export const operators = DEMO_OPERATORS;
export const offers = DEMO_OFFERS;
export const orders = new Map<string, Order>();
