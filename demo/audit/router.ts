import { USER_ROLES } from "@marigold/db";

import { router } from "../trpc";
import { protectedProcedure } from "../trpc/index";
import { AuditService } from "./service";
import { getTimelineDataSchema } from "./validations";

export const AuditRouter = router({
  getTimelineData: protectedProcedure(USER_ROLES.admin, USER_ROLES.superAdmin)
    .input(getTimelineDataSchema)
    .query(({ ctx, input }) => {
      return AuditService.getTimelineData(input, ctx.session.userInfo.userRole);
    }),
});
