import { uuidv7 } from "uuidv7";

/** UUID v7 — time-ordered, sortable, suitable for DB primary key */
export function newId(): string {
  return uuidv7();
}
