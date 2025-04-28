import dayjs from "dayjs";

import type { audit } from "../../../../db/src/schema/audit";
import type { Conversation } from "../../twilio-flex/types";
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

export class SmsCallsHelper {
  /**
   * Creates an audit record for changes to sms calls section
   */
  static async auditSmsCallChanges(input: {
    action: EVENT_TYPE_ENUM | CHANGE_TYPE_ENUM;
    actorId?: number;
    targetUser: number;
    columns: Change[];
    references: AuditReference[];
  }) {
    const changes: ChangeToAudit[] = input.columns.map((column) => ({
      mapping_id: CHANGE_TYPE_ENUM.SMS_AND_CALLS,
      field: column.field,
      prev: column.prev ?? "",
      updated: column.updated ?? "",
    }));

    const callTimeStamp = changes.find((change) => change.field === "timestamp");

    if (changes.length > 0) {
      await AuditDAL.insertAuditRecord({
        userId: input.targetUser,
        associatedPeerId: input.actorId,
        eventType: input.action,
        section: AUDIT_SECTIONS_ENUM.SMS_AND_CALLS,
        changes: changes,
        references: input.references,
        ...(callTimeStamp?.updated
          ? { occurredAt: dayjs.utc(callTimeStamp.updated).toDate() }
          : {}),
      });
    }
  }

  static async handleSmsCallChanges(
    record: typeof audit.$inferSelect,
    actor: string,
  ): Promise<AuditQueryResponse> {
    switch (record.eventType) {
      case CHANGE_TYPE_ENUM.CALL_RECEIVED:
        return this.handleCallReceivedEvent(record);
      case CHANGE_TYPE_ENUM.CALL_MADE:
        return this.handleCallMadeEvent(record);
      case CHANGE_TYPE_ENUM.SMS:
        return this.handleSmsEvent(record);
      default:
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

  static async handleSmsEvent(record: typeof audit.$inferSelect) {
    const conversationsString = record.changes?.[0]?.updated as string;
    const conversations = JSON.parse(conversationsString) as Conversation[];

    let disposition;

    const values = conversations.reduce((acc, conversation) => {
      disposition = conversation.disposition;
      if (conversation.type === "sms-sent") {
        acc.push({
          updated: conversation.messageText,
          type: CHANGE_TYPE_ENUM.SMS,
          prev: "",
          //Note: The conversation.type is stored as per user's perspective whereas when we display the timeline event we need to display as per peer's perspective
          field: `SMS received from member's ${conversation.source ?? "phone number"} (${conversation.senderPhoneNumber}) to peer (${conversation.name}) on (${conversation.receiverPhoneNumber})`,
        });
      } else if (conversation.type === "sms-received") {
        acc.push({
          updated: conversation.messageText,
          type: CHANGE_TYPE_ENUM.SMS,
          prev: "",
          //Note: The conversation.type is stored as per user's perspective whereas when we display the timeline event we need to display as per peer's perspective
          field: `SMS sent by peer (${conversation.name}) (${conversation.senderPhoneNumber}) to member's ${conversation.source ?? "phone number"} (${conversation.receiverPhoneNumber})`,
        });
      }
      return acc;
    }, [] as ChangeToDisplay[]);

    values.push({
      type: CHANGE_TYPE_ENUM.SMS,
      prev: "",
      field: "disposition",
      updated: disposition ?? "",
    });

    const title = `SMS Conversation between ${conversations[0]?.source} (${conversations[0]?.type === "sms-sent" ? conversations[0]?.senderPhoneNumber : conversations[0]?.receiverPhoneNumber}) and ${conversations[0]?.name} (${conversations[0]?.type === "sms-sent" ? conversations[0]?.receiverPhoneNumber : conversations[0]?.senderPhoneNumber})`;

    return {
      id: record.id,
      eventType: record.eventType,
      icon: ICON_ENUM.SMS,
      title: title,
      values: values,
      occurredAt: record.occurredAt,
    };
  }

  static async handleCallReceivedEvent(record: typeof audit.$inferSelect) {
    const name = record.changes.find((change) => change.field === "name");
    const phoneSource = record.changes.find((change) => change.field === "phoneSource");
    const duration = record.changes.find((change) => change.field === "duration");
    const receiverPhoneNumber = record.changes.find(
      (change) => change.field === "receiverPhoneNumber",
    );

    return {
      id: record.id,
      eventType: record.eventType,
      icon: ICON_ENUM.CALL,
      title: `Call made to ${phoneSource?.updated ?? ""} (${receiverPhoneNumber?.updated ?? ""}) by ${name?.updated ?? ""}  (Duration: ${duration?.updated} Minutes)`,
      values: [],
      occurredAt: record.occurredAt,
    };
  }

  static async handleCallMadeEvent(record: typeof audit.$inferSelect) {
    const name = record.changes.find((change) => change.field === "name");
    const phoneSource = record.changes.find((change) => change.field === "phoneSource");
    const duration = record.changes.find((change) => change.field === "duration");
    const senderPhoneNumber = record.changes.find((change) => change.field === "senderPhoneNumber");

    return {
      id: record.id,
      eventType: record.eventType,
      icon: ICON_ENUM.CALL,
      title: `Incoming call from ${phoneSource?.updated ?? ""} (${senderPhoneNumber?.updated ?? ""}) by ${name?.updated ?? ""} (Duration: ${duration?.updated} Minutes)`,
      values: [],
      occurredAt: record.occurredAt,
    };
  }
}
