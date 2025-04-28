import dayjs from "dayjs";
import advancedFormat from "dayjs/plugin/advancedFormat";
import relativeTime from "dayjs/plugin/relativeTime";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";

import type { audit } from "../../../../db/src/schema/audit";
import type {
  AuditQueryResponse,
  AuditReference,
  Change,
  ChangeToAudit,
  ChangeToDisplay,
  EVENT_TYPE_ENUM,
} from "../constants";
import { AUDIT_SECTIONS_ENUM, CHANGE_TYPE_ENUM, ICON_ENUM } from "../constants";
import { AuditDAL } from "../dal";

export class MixPanelEventsHelper {
  /**
   * Creates an audit record for changes to sms calls section
   */
  static async auditMixPanelEventsChanges(input: {
    action: EVENT_TYPE_ENUM | CHANGE_TYPE_ENUM;
    actorId?: number;
    targetUser: number;
    columns: Change[];
    references: AuditReference[];
    occurredAt?: string;
  }) {
    dayjs.extend(utc);
    dayjs.extend(timezone);

    const changes: ChangeToAudit[] = input.columns.map((column) => ({
      mapping_id: CHANGE_TYPE_ENUM.SMS_AND_CALLS,
      field: column.field,
      prev: column.prev ?? "",
      updated: column.updated ?? "",
    }));

    if (changes.length > 0) {
      await AuditDAL.insertAuditRecord({
        userId: input.targetUser,
        associatedPeerId: input.actorId,
        eventType: input.action,
        section: AUDIT_SECTIONS_ENUM.MIX_PANEL_EVENTS,
        changes: changes,
        references: input.references,
        // Setting the UTC Time to 4:59:59 AM to match 23:59:59 PM previous day in EST
        ...(input.occurredAt
          ? { occurredAt: dayjs.utc(`${input.occurredAt} 4:59:59`).toDate() }
          : {}),
      });
    }
  }

  static async handleMixPanelEventChanges(
    record: typeof audit.$inferSelect,
    actor: string,
  ): Promise<AuditQueryResponse> {
    if (record.eventType === CHANGE_TYPE_ENUM.MIX_PANEL_EVENT) {
      return this.handleMixPanelEvent(record);
    } else {
      return {
        id: record.id,
        eventType: record.eventType,
        icon: ICON_ENUM.SMS,
        title: ``,
        values: [],
        occurredAt: record.occurredAt,
      };
    }
  }

  static async handleMixPanelEvent(record: typeof audit.$inferSelect) {
    const eventsString = record.changes?.[0]?.updated as string;
    const events = JSON.parse(eventsString) as { event: string; timestamp: number }[];

    const changes: ChangeToDisplay[] = [];

    events.forEach((event) => {
      changes.push({
        updated: event.event.includes("Tab")
          ? `Opened ${event.event} for the first time today at `
          : `${event.event} for the first time today at `,
        type: CHANGE_TYPE_ENUM.MIX_PANEL_EVENT,
        prev: "",
        field: this.formatTimeToET(event.timestamp),
      });
    });

    return {
      id: record.id,
      eventType: record.eventType,
      icon: ICON_ENUM.BADGE,
      title: `Mix Panel Events for the User`,
      values: changes,
      occurredAt: record.occurredAt,
    };
  }

  private static formatTimeToET(date: number): string {
    dayjs.extend(utc);
    dayjs.extend(timezone);
    dayjs.extend(relativeTime);
    dayjs.extend(advancedFormat);
    return date ? dayjs.utc(date).tz("America/New_York").format("hh:mm:ss A [ET]") : " ";
  }
}
