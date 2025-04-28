import { z } from "zod";

import { AUDIT_SECTIONS_ENUM } from "./constants";

export const getTimelineDataSchema = z.object({
  section: z.nativeEnum(AUDIT_SECTIONS_ENUM),
  userId: z.number().int(),
  limit: z.number().int().gt(0),
  page: z.number().int().gt(0),
});
