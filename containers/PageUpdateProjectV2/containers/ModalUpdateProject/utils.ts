import moment from "moment";

import { UnixTimestamp } from "@/modules/business-types";

const DAY_IN_MS = 86400000;

export function timeToExpiry(expiryTimestamp: UnixTimestamp): string {
  const diff = moment(expiryTimestamp).diff(moment());
  if (diff <= 0) return "Expired";
  if (diff <= DAY_IN_MS) return "Expires in a day";
  return `Expires in ${Math.floor((diff - 1) / DAY_IN_MS) + 1} days`;
}
