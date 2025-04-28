import { TRPCError } from "@trpc/server";

import type { audit } from "../../../../db/src/schema/audit";
import type { AuditQueryResponse, AuditReference, Change, ChangeToAudit } from "../constants";
import { GroupsDAL } from "../../services";
import { UsersDAL } from "../../user/dal";
import {
  AUDIT_SECTIONS_ENUM,
  CHANGE_TYPE_ENUM,
  EVENT_TYPE_ENUM,
  fieldMap,
  ICON_ENUM,
} from "../constants";
import { AuditDAL } from "../dal";
import { AuditService } from "../service";

export class ChangesToProfileHelper {
  /**
   * Creates an audit record for changes to profile section.
   */
  static async auditProfileChanges(input: {
    action: EVENT_TYPE_ENUM | CHANGE_TYPE_ENUM;
    actorId?: number;
    targetUser: number;
    columns: Change[];
    references: AuditReference[];
  }) {
    const record = {
      userId: input.targetUser,
      associatedPeerId: input.actorId,
      eventType: input.action,
      section: AUDIT_SECTIONS_ENUM.CHANGES_TO_PROFILE,
      changes: [] as ChangeToAudit[],
      references: input.references,
    };
    for (const column of input.columns) {
      const mapData = fieldMap[`${column.table}_${column.field}`];
      const change: ChangeToAudit = {
        mapping_id: mapData?.type ?? CHANGE_TYPE_ENUM.FIELD_CHANGE,
        field: `${column.table}.${column.field}`,
        prev: column.prev,
        updated: column.updated,
      };
      record.changes.push(change);
    }

    if (record.changes.length > 0) await AuditDAL.insertAuditRecord(record);
  }

  static async handleProfileChanges(
    record: typeof audit.$inferSelect,
    actor: string,
  ): Promise<AuditQueryResponse> {
    switch (record.eventType) {
      case EVENT_TYPE_ENUM.SIGNIN_EVENT:
        return {
          id: record.id,
          title: "Member signed in",
          eventType: record.eventType,
          icon: ICON_ENUM.EVENT_GENERIC,
          occurredAt: record.occurredAt,
          values: [],
        };
      case EVENT_TYPE_ENUM.SIGNUP_EVENT:
        return {
          id: record.id,
          title: "Member signed up",
          eventType: record.eventType,
          icon: ICON_ENUM.EVENT_GENERIC,
          occurredAt: record.occurredAt,
          values: [],
        };
      case EVENT_TYPE_ENUM.CONSENT_SIGNED_EVENT:
        return {
          id: record.id,
          title: "Consent signed by member",
          eventType: record.eventType,
          icon: ICON_ENUM.CONSENT_COMPLETE_EVENT,
          occurredAt: record.occurredAt,
          values: [],
        };
      case EVENT_TYPE_ENUM.CONSENT_APPROVED_EVENT:
        return {
          id: record.id,
          title: `Consent approved by ${actor}`,
          eventType: record.eventType,
          icon: ICON_ENUM.EVENT_GENERIC,
          occurredAt: record.occurredAt,
          values: [],
        };
      case EVENT_TYPE_ENUM.CONSENT_RESET_EVENT:
        return {
          id: record.id,
          title: `Consent reset by ${actor}`,
          eventType: record.eventType,
          icon: ICON_ENUM.EVENT_GENERIC,
          occurredAt: record.occurredAt,
          values: [],
        };
      case EVENT_TYPE_ENUM.LOGGED_OUT_EVENT:
        return {
          id: record.id,
          title: "Member signed out",
          eventType: record.eventType,
          icon: ICON_ENUM.LOGOUT_EVENT,
          occurredAt: record.occurredAt,
          values: [],
        };
      case EVENT_TYPE_ENUM.USER_DISABLED_EVENT:
        return {
          id: record.id,
          title: `Member blacklisted by ${actor}`,
          eventType: record.eventType,
          icon: ICON_ENUM.BLACKLISTED_ACCOUNT_EVENT,
          occurredAt: record.occurredAt,
          values: [],
        };
      case EVENT_TYPE_ENUM.USER_FORCE_LOGOUT_EVENT:
        return {
          id: record.id,
          title: `Forced Logout done by ${actor}`,
          eventType: record.eventType,
          icon: ICON_ENUM.FORCED_LOGOUT_EVENT,
          occurredAt: record.occurredAt,
          values: [],
        };
      case EVENT_TYPE_ENUM.ARCHIVED_ACCOUNT_EVENT:
        return {
          id: record.id,
          title: `Archived account done by ${actor}`,
          eventType: record.eventType,
          icon: ICON_ENUM.ACCOUNT_ARCHIVED_EVENT,
          occurredAt: record.occurredAt,
          values: [],
        };
      case EVENT_TYPE_ENUM.ACCOUNT_DELETED_EVENT:
        return {
          id: record.id,
          title: `Account deleted by Member`,
          eventType: record.eventType,
          icon: ICON_ENUM.ACCOUNT_ARCHIVED_EVENT,
          occurredAt: record.occurredAt,
          values: [],
        };
      case EVENT_TYPE_ENUM.USER_DUPLICATE_EVENT:
        return {
          id: record.id,
          title: `Duplicate account done by ${actor}`,
          eventType: record.eventType,
          icon: ICON_ENUM.DUPLICATE_ACCOUNT_EVENT,
          occurredAt: record.occurredAt,
          values: [],
        };
      case EVENT_TYPE_ENUM.ADD_USER_TO_GROUP_EVENT:
        return await this.handleAddUserToGroupEvent(record, actor);
      case EVENT_TYPE_ENUM.NEW_DM_CREATED_EVENT:
        return await this.handleNewDMCreatedEvent(record, actor);
      case EVENT_TYPE_ENUM.DM_OPENED_EVENT:
        return {
          id: record.id,
          title: `DM opened by ${actor}`,
          eventType: record.eventType,
          icon: ICON_ENUM.EVENT_GENERIC,
          occurredAt: record.occurredAt,
          values: [],
        };
      case EVENT_TYPE_ENUM.DM_RESOLVED_EVENT:
        return {
          id: record.id,
          title: `DM resolved by ${actor}`,
          eventType: record.eventType,
          icon: ICON_ENUM.EVENT_GENERIC,
          occurredAt: record.occurredAt,
          values: [],
        };
      case EVENT_TYPE_ENUM.PROFILE_BIO_APPROVED:
        return {
          id: record.id,
          title: `App Profile Bio approved by ${actor}`,
          eventType: record.eventType,
          icon: ICON_ENUM.EVENT_GENERIC,
          occurredAt: record.occurredAt,
          values: [],
        };
      case EVENT_TYPE_ENUM.PROFILE_BIO_REJECTED:
        return this.handleProfileRejectedEvent(record, actor);
      case CHANGE_TYPE_ENUM.FIELD_CHANGE:
        return record.changes.length === 1
          ? AuditService.handleFieldChange(record, record.changes[0]!, actor)
          : AuditService.handleDefaultBatchChange(record, record.changes, actor);
      case CHANGE_TYPE_ENUM.USER_BLACKLISTED:
        return this.handleBlackListEvent(record, actor);
      case CHANGE_TYPE_ENUM.USER_UNDO_BLACKLISTED:
        return this.handleBlackListEvent(record, actor);
      default:
        return AuditService.handleDefaultBatchChange(record, record.changes, actor);
    }
  }

  static async handleProfileRejectedEvent(record: typeof audit.$inferSelect, actor: string) {
    const tags = record.changes.find((change) => change.field === "tags")?.updated;
    const supportChatMessage = record.changes.find(
      (change) => change.field === "supportChatMessage",
    )?.updated;

    const bio = record.changes.find((change) => change.field === "bio")?.updated;

    return {
      id: record.id,
      title: `${actor} just rejected your Bio "${bio}" with tag ${tags}, Reason: {${supportChatMessage}}`,
      eventType: record.eventType,
      icon: ICON_ENUM.EVENT_GENERIC,
      occurredAt: record.occurredAt,
      values: [],
    };
  }

  /**
   * Handles the event where a user is added to a group.
   */
  static async handleAddUserToGroupEvent(
    record: typeof audit.$inferSelect,
    actor: string,
  ): Promise<AuditQueryResponse> {
    const groupName = (await GroupsDAL.getGroupById(Number(record.references?.[0]?.value)))?.name;

    return {
      id: record.id,
      title: `Added to group "${groupName ?? "Unknown"}" by ${actor}`,
      eventType: record.eventType,
      icon: ICON_ENUM.EVENT_GENERIC,
      occurredAt: record.occurredAt,
      values: [],
    };
  }

  /**
   * Handles the event where a user is blacklisted or un-blacklisted.
   */
  static async handleBlackListEvent(
    record: typeof audit.$inferSelect,
    actor: string,
  ): Promise<AuditQueryResponse> {
    const blackList = record.changes.find((change) => change.field === "blackList.deviceId");

    const blackListDeviceId = blackList?.updated ? `(Device Id: ${blackList.updated})` : "";

    return {
      id: record.id,
      title: `Member ${record.eventType === CHANGE_TYPE_ENUM.USER_BLACKLISTED ? "blacklisted" : "undo-blacklisted"} by ${actor} ${blackListDeviceId}`,
      eventType: record.eventType,
      icon: ICON_ENUM.BLACKLISTED_ACCOUNT_EVENT,
      occurredAt: record.occurredAt,
      values: [],
    };
  }

  /**
   * Handles the event where a new direct message is created.
   */
  static async handleNewDMCreatedEvent(
    record: typeof audit.$inferSelect,
    actor: string,
  ): Promise<AuditQueryResponse> {
    const userId = record.references?.[0]?.value;
    const userName = userId ? (await UsersDAL.getUserById(Number(userId)))?.username : "Unknown";

    return {
      id: record.id,
      title: `Started a DM with "${userName}" by ${actor}`,
      eventType: record.eventType,
      icon: ICON_ENUM.EVENT_GENERIC,
      occurredAt: record.occurredAt,
      values: [],
    };
  }

  /**
   * Handles the event when a user status changed in a group
   */
  static async handleUserGroupStatusChange(
    record: typeof audit.$inferSelect,
    change: ChangeToAudit,
    actor: string,
  ): Promise<AuditQueryResponse> {
    const groupName = (await GroupsDAL.getGroupById(Number(record.references?.[0]?.value)))?.name;

    // We are using "pausedBy" column to determine the user's status in a group.
    const updatedStatus = change.updated ? "PAUSED" : "ACTIVE";
    const prevStatus = change.prev ? "PAUSED" : "ACTIVE";

    const [table, column] = change.field.split(".");
    if (!table || !column) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Field Name not in expected format",
      });
    }

    return {
      id: record.id,
      occurredAt: record.occurredAt,
      title: `${actor} marked "${updatedStatus}" in "${groupName ?? "Unknown"}"`,
      eventType: record.eventType,
      icon: this.getIcon(change.field),
      values: [
        {
          field: "status",
          prev: prevStatus,
          updated: updatedStatus,
          type: CHANGE_TYPE_ENUM.USER_GROUP_STATUS_CHANGE,
        },
      ],
    };
  }

  /**
   * Handles single change for peer-change eventType.
   */
  static async handlePeerChange(
    record: typeof audit.$inferSelect,
    change: ChangeToAudit,
    actor: string,
  ): Promise<AuditQueryResponse> {
    const prevValue = (change.prev as string) || "";
    const updatedValue = (change.updated as string) || "";

    const oldPeerName = await this.getPeerName(prevValue);
    const newPeerName = await this.getPeerName(updatedValue);

    const peerType = this.determinePeerType(prevValue, updatedValue);

    const [table, column] = change.field.split(".");
    if (!table || !column) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Field Name not in expected format",
      });
    }

    return {
      id: record.id,
      occurredAt: record.occurredAt,
      title: `${peerType} Peer changed to ${newPeerName ?? "None"} by ${actor}`,
      eventType: record.eventType,
      icon: this.getIcon(change.field),
      values: [
        {
          field: `${peerType} Peer`,
          prev: oldPeerName ?? "",
          updated: newPeerName ?? "",
          type: CHANGE_TYPE_ENUM.PEER_CHANGE,
        },
      ],
    };
  }

  private static async getPeerName(value: string) {
    if (!value) return null;
    const peerId = Number(value.split("-")[0]);
    return (await UsersDAL.getUserById(peerId))?.username ?? "";
  }

  private static determinePeerType(prevValue: string, updatedValue: string) {
    if (prevValue.includes("assigned") || updatedValue.includes("assigned")) {
      return "Assigned";
    }
    if (prevValue.includes("enrollment") || updatedValue.includes("enrollment")) {
      return "Enrollment";
    }
    return "";
  }

  private static getIcon(field: string) {
    const [table, column] = field.split(".");
    return fieldMap[`${table}_${column}`]?.icon ?? ICON_ENUM.PROFILE;
  }
}
