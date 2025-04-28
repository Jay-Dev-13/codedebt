import { and, asc, count, DB, desc, eq, inArray, isNull, or, sql } from "@marigold/db";

import type { EVENT_TYPE_ENUM } from "./constants";
import { audit } from "../../../db/src/schema/audit";
import { AUDIT_SECTIONS_ENUM, CHANGE_TYPE_ENUM } from "./constants";

export class AuditDAL {
  /**
   * @dataType {Public | Admin Only | Owner Only}: Admin Only
   */
  static async getAuditRecords(input: {
    sections: AUDIT_SECTIONS_ENUM[];
    limit: number;
    page: number;
    userId: number;
  }) {
    let sections: AUDIT_SECTIONS_ENUM[];
    if (input.sections.includes(AUDIT_SECTIONS_ENUM.ALL_FORMS)) {
      sections = [AUDIT_SECTIONS_ENUM.STAFF_NOTES, AUDIT_SECTIONS_ENUM.MEMBER_SURVEYS];
    } else if (input.sections.includes(AUDIT_SECTIONS_ENUM.ALL)) {
      sections = [
        AUDIT_SECTIONS_ENUM.CHANGES_TO_PROFILE,
        AUDIT_SECTIONS_ENUM.ELIGIBILITY,
        AUDIT_SECTIONS_ENUM.MEMBER_SURVEYS,
        AUDIT_SECTIONS_ENUM.STAFF_NOTES,
        AUDIT_SECTIONS_ENUM.TODO,
        AUDIT_SECTIONS_ENUM.WELLNESS_PLAN,
        AUDIT_SECTIONS_ENUM.SMS_AND_CALLS,
        AUDIT_SECTIONS_ENUM.MIX_PANEL_EVENTS,
      ];
    } else {
      sections = input.sections;
    }

    const [totalCount] = await DB.select({ count: count() })
      .from(audit)
      .where(and(eq(audit.userId, input.userId), inArray(audit.section, sections)));

    const records = await DB.select()
      .from(audit)
      .where(and(eq(audit.userId, input.userId), inArray(audit.section, sections)))
      .orderBy(desc(audit.occurredAt))
      .offset((input.page - 1) * input.limit)
      .limit(input.limit);

    return { totalCount: totalCount?.count ?? 0, records };
  }

  static insertAuditRecord(record: typeof audit.$inferInsert) {
    return DB.insert(audit).values(record).returning();
  }

  static async getAuditRecordCountByEventTypeAndDate(
    eventType: EVENT_TYPE_ENUM | CHANGE_TYPE_ENUM,
    date: Date,
  ) {
    const [totalCount] = await DB.select({ count: count() })
      .from(audit)
      .where(and(eq(audit.eventType, eventType), eq(audit.occurredAt, date)));

    return totalCount;
  }

  static async getRecordsForEventTypes(
    eventType: (EVENT_TYPE_ENUM | CHANGE_TYPE_ENUM)[],
    userId: number,
  ) {
    const records = await DB.select()
      .from(audit)
      .where(and(inArray(audit.eventType, eventType), eq(audit.userId, userId)))
      .orderBy(asc(audit.occurredAt));

    return records;
  }

  static async getRecordByIdAndUserId(id: number, userId: number) {
    const record = await DB.select()
      .from(audit)
      .where(and(eq(audit.id, id), eq(audit.userId, userId)));

    return record[0];
  }

  static async getRecentActivity(userId: number) {
    const record = await DB.select()
      .from(audit)
      .where(
        and(
          isNull(audit.associatedPeerId),
          eq(audit.userId, userId),
          or(
            inArray(audit.section, [
              AUDIT_SECTIONS_ENUM.MEMBER_SURVEYS,
              AUDIT_SECTIONS_ENUM.WELLNESS_PLAN,
            ]),
            and(
              eq(audit.section, AUDIT_SECTIONS_ENUM.CHANGES_TO_PROFILE),
              eq(audit.eventType, CHANGE_TYPE_ENUM.FIELD_CHANGE),
              sql`jsonb_path_exists(${audit.changes}, ${'$[*] ? (@.field == "userInfos.bio")'})`,
            ),
          ),
        ),
      )
      .orderBy(desc(audit.occurredAt))
      .limit(1);

    return record[0];
  }
}
