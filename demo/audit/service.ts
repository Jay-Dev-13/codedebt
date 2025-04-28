import type { z } from "zod";
import { TRPCError } from "@trpc/server";

import { USER_ROLES } from "@marigold/db";

import type { audit } from "../../../db/src/schema/audit";
import type { ActivityData } from "../user/types";
import type {
  AuditParams,
  AuditQueryResponse,
  Change,
  ChangeToAudit,
  FilteredChanges,
  RecordToCompare,
} from "./constants";
import type { getTimelineDataSchema } from "./validations";
import { MIXPANEL_EVENTS, MIXPANEL_SOURCE } from "../mixpanel/constants";
import { generateMixpanelEvent } from "../mixpanel/service";
import { SitesDAL } from "../sites/dal";
import { TerritoriesDAL } from "../territories/dal";
import { UsersDAL } from "../user/dal";
import {
  AUDIT_SECTIONS_ENUM,
  CHANGE_TYPE_ENUM,
  EVENT_TYPE_ENUM,
  fieldMap,
  ICON_ENUM,
} from "./constants";
import { AuditDAL } from "./dal";
import { ChangesToProfileHelper } from "./helpers/changesToProfile.helper";
import { EligibilityHelper } from "./helpers/eligibility.helper";
import { MemberSurveyHelper } from "./helpers/memberSurvey.helper";
import { MixPanelEventsHelper } from "./helpers/mixPanelEvents.helper";
import { SmsCallsHelper } from "./helpers/smsCalls.helper";
import { TodoHelper } from "./helpers/todo.helper";
import { WellnessJourneyHelper } from "./helpers/wellnessJourney.helper";

export class AuditService {
  /**
   * Takes in records to look for changes and inserts them to the audit table.
   * Events should not have any changes passed withing them.
   * All other changes will be considered only if their columns are present in the FieldMap object.
   */
  static async auditChanges(params: AuditParams): Promise<void> {
    try {
      if (params.actorId) {
        const actor = await UsersDAL.getUserById(params.actorId);
        // Note: If the actor is a member, we don't want to store their ID in the associatedPeerId
        if (actor?.userRole === USER_ROLES.member) {
          delete params.actorId;
        }
      }

      if (Object.values(EVENT_TYPE_ENUM).includes(params.action as EVENT_TYPE_ENUM)) {
        await this.auditEvent(params);
        return;
      }
      const changes = this.compareQueryResults(params.changes);

      const {
        profileChanges,
        eligibilityChanges,
        wellnessPlanChanges,
        todoChanges,
        smsAndCallChanges,
        mixPanelEventChanges,
      } = this.filterChanges(changes);

      const auditTasks = [
        profileChanges.length &&
          ChangesToProfileHelper.auditProfileChanges({ ...params, columns: profileChanges }),
        eligibilityChanges.length &&
          EligibilityHelper.auditEligibilityChanges({ ...params, columns: eligibilityChanges }),
        wellnessPlanChanges.length &&
          WellnessJourneyHelper.auditWellnessChanges({ ...params, columns: wellnessPlanChanges }),
        todoChanges.length && TodoHelper.auditTodoChanges({ ...params, columns: todoChanges }),
        smsAndCallChanges.length &&
          SmsCallsHelper.auditSmsCallChanges({ ...params, columns: smsAndCallChanges }),
        mixPanelEventChanges.length &&
          MixPanelEventsHelper.auditMixPanelEventsChanges({
            ...params,
            columns: mixPanelEventChanges,
            occurredAt: params.occurredAt,
          }),
      ].filter(Boolean) as Promise<void>[];

      await Promise.all(auditTasks);
    } catch (error) {
      console.error(
        `Error while adding audit entry; input params : ${JSON.stringify(params)}`,
        error,
      );
    }
  }

  /**
   * Retrieves and transforms Audit Records into a timeline data format.
   */
  static async getTimelineData(input: z.infer<typeof getTimelineDataSchema>, userRole: USER_ROLES) {
    const { records, totalCount } = await AuditDAL.getAuditRecords({
      ...input,
      sections: [input.section],
    });
    const data = await Promise.all(
      records.map(async (record) => {
        let result;
        try {
          result = await this.buildTimelineEntry(record, userRole);
        } catch (error) {
          console.error(error);
          await generateMixpanelEvent({
            event: MIXPANEL_EVENTS.LOAD_TIMELINE_RECORDS,
            source: MIXPANEL_SOURCE.TIMELINE,
            data: {
              message: `Something went wrong while processing the audit table record with id: ${record.id}`,
              recordInfo: {
                section: record.section,
                eventType: record.eventType,
              },
            },
            failSilently: true,
            error,
          });

          result = {
            id: record.id,
            title: `Something went wrong while processing "${record.eventType}"`,
            occurredAt: record.occurredAt,
            icon: ICON_ENUM.EVENT_GENERIC,
            eventType: record.eventType,
            values: [],
          };
        }
        return result;
      }),
    );
    return { data, totalCount };
  }

  static async getRecentActivity(input: {
    userId: number;
    actorRole: USER_ROLES;
  }): Promise<ActivityData | null> {
    const record = await AuditDAL.getRecentActivity(input.userId);

    if (!record) return null;

    if (!this.isRecentActivitySection(record.section)) {
      return null;
    }

    const data = await this.buildTimelineEntry(record, input.actorRole);

    return {
      id: record.id,
      title: data.title + " on " + MemberSurveyHelper.formatDateToET(record.occurredAt),
      section: record.section,
      occurredAt: record.occurredAt,
    };
  }

  private static isRecentActivitySection(
    section: string,
  ): section is
    | AUDIT_SECTIONS_ENUM.CHANGES_TO_PROFILE
    | AUDIT_SECTIONS_ENUM.MEMBER_SURVEYS
    | AUDIT_SECTIONS_ENUM.WELLNESS_PLAN {
    return Object.values([
      AUDIT_SECTIONS_ENUM.CHANGES_TO_PROFILE,
      AUDIT_SECTIONS_ENUM.MEMBER_SURVEYS,
      AUDIT_SECTIONS_ENUM.WELLNESS_PLAN,
    ]).includes(section as AUDIT_SECTIONS_ENUM);
  }

  /**
   * Builds a timeline entry for a given audit record.
   */
  private static async buildTimelineEntry(
    record: typeof audit.$inferSelect,
    userRole: USER_ROLES,
  ): Promise<AuditQueryResponse> {
    const actor = await this.getActor(record.associatedPeerId);
    switch (record.section as AUDIT_SECTIONS_ENUM) {
      case AUDIT_SECTIONS_ENUM.CHANGES_TO_PROFILE:
        return ChangesToProfileHelper.handleProfileChanges(record, actor);
      case AUDIT_SECTIONS_ENUM.ELIGIBILITY:
        return EligibilityHelper.handleEligibilityChanges(record, actor);
      case AUDIT_SECTIONS_ENUM.WELLNESS_PLAN:
        return WellnessJourneyHelper.handleWellnessJourneyChanges(record, actor);
      case AUDIT_SECTIONS_ENUM.TODO:
        return TodoHelper.handleTodoChanges(record, actor);
      case AUDIT_SECTIONS_ENUM.MEMBER_SURVEYS:
        return MemberSurveyHelper.handleMemberSurveyChanges(record, actor);
      case AUDIT_SECTIONS_ENUM.STAFF_NOTES:
        return MemberSurveyHelper.handleStaffNoteChanges(record, actor, userRole);
      case AUDIT_SECTIONS_ENUM.SMS_AND_CALLS:
        return SmsCallsHelper.handleSmsCallChanges(record, actor);
      case AUDIT_SECTIONS_ENUM.MIX_PANEL_EVENTS:
        return MixPanelEventsHelper.handleMixPanelEventChanges(record, actor);
      default:
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Unhandled section" });
    }
  }

  /**
   * Handles the default batch change processing.
   */
  static async handleDefaultBatchChange(
    record: typeof audit.$inferSelect,
    changes: ChangeToAudit[],
    actor: string,
  ) {
    const messagePrefix = changes
      .map((change) => {
        const [table, column] = change.field.split(".");
        if (!table || !column) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Field Name not in expected format",
          });
        }

        // When the peer type is changed, we want to use a more user friendly name
        // than just "type". This is a special case because the field name is
        // "peers.type" and we want to handle it differently than other fields.
        if (table === "peers" && change.field === "peers.type") {
          const strings = [change.prev, change.updated].filter(Boolean) as string[];
          const hasAssigned = strings.some((s) => s.includes("assigned"));
          const hasEnrollment = strings.some((s) => s.includes("enrollment"));
          if (hasAssigned) {
            return "Assigned Peer";
          }
          if (hasEnrollment) {
            return "Enrollment Peer";
          }
          return undefined;
        }

        // For all other fields, we can just use the displayName from the fieldMap
        return fieldMap[`${table}_${column}`]?.displayName ?? "Unknown Field";
      })
      .join(", ");

    const values = await Promise.all(
      changes.map(async (change) => {
        const { column, table } = this.separateTableAndColumnFromField(change.field);
        const mapData = fieldMap[`${table}_${column}`];

        let field = mapData?.displayName ?? "Field";

        // If the mapping_id is PEER_CHANGE, we need to handle the field name slightly differently.
        // This is a special case because the field name is "peers.type" and we want to handle it
        // differently than other fields.
        // So, we need to check if both the prev and updated values contain "assigned" or
        // "enrollment", and use the appropriate field name.
        if (change.mapping_id === CHANGE_TYPE_ENUM.PEER_CHANGE) {
          const prevString = (change.prev as string) || "";
          const updatedString = (change.updated as string) || "";

          if (prevString.includes("assigned") || updatedString.includes("assigned")) {
            field = "Assigned Peer";
          } else if (prevString.includes("enrollment") || updatedString.includes("enrollment")) {
            field = "Enrollment Peer";
          }
        }

        if (change.mapping_id === CHANGE_TYPE_ENUM.PEER_CHANGE) {
          await this.handlePeersPeerId(change);
        }

        if (column === "territoryId") {
          await this.handleTerritoryId(change);
        }

        if (column === "siteId") {
          await this.handleSiteId(change);
        }

        return {
          field: field,
          prev: change.prev?.toString() ?? "",
          updated: change.updated?.toString() ?? "",
          type: mapData?.type ?? CHANGE_TYPE_ENUM.FIELD_CHANGE,
        };
      }),
    );

    return {
      id: record.id,
      title: `${messagePrefix} changed by ${actor}`,
      occurredAt: record.occurredAt,
      icon: ICON_ENUM.PROFILE,
      eventType: record.eventType,
      values,
    };
  }

  /**
   * Retrieves the actor name.
   */
  private static async getActor(associatedPeerId: number | null): Promise<string> {
    if (!associatedPeerId) return "member";
    const user = await UsersDAL.getUserById(associatedPeerId);
    return user?.username ?? "member";
  }

  /**
   * Handles single change for field-change eventType.
   */
  static async handleFieldChange(
    record: typeof audit.$inferSelect,
    change: ChangeToAudit,
    actor: string,
  ): Promise<AuditQueryResponse> {
    if (change.mapping_id === CHANGE_TYPE_ENUM.PEER_CHANGE)
      return ChangesToProfileHelper.handlePeerChange(record, change, actor);

    if (change.mapping_id === CHANGE_TYPE_ENUM.USER_GROUP_STATUS_CHANGE)
      return ChangesToProfileHelper.handleUserGroupStatusChange(record, change, actor);

    const [table, column] = change.field.split(".");
    if (!table || !column)
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Field Name not in expected format",
      });

    const existingRecordAction = !change.updated ? "removed by" : "changed by";

    const action = !change.prev ? "added by" : existingRecordAction;

    const fieldDisplayName = fieldMap[`${table}_${column}`]?.displayName ?? "Unknown Field";

    return {
      id: record.id,
      title: `${fieldDisplayName} ${action} ${actor}`,
      occurredAt: record.occurredAt,
      eventType: record.eventType,
      icon: fieldMap[`${table}_${column}`]?.icon ?? ICON_ENUM.PROFILE,
      values: [
        {
          field: fieldDisplayName,
          prev: change.prev?.toString() ?? "",
          updated: change.updated?.toString() ?? "",
          type: "field-change",
        },
      ],
    };
  }

  /**
   * Compares query results to detect changes.
   */
  private static compareQueryResults(changes: RecordToCompare[]): Change[] {
    return changes.flatMap(({ table, oldRecord, newRecord }) => {
      const fields = new Set([...Object.keys(oldRecord), ...Object.keys(newRecord)]);

      return Array.from(fields).reduce<Change[]>((acc, field) => {
        const oldValue = oldRecord[field];
        const newValue = newRecord[field];

        // Check if both values are Date objects
        const isOldValueDate = oldValue instanceof Date;
        const isNewValueDate = newValue instanceof Date;

        // Check if both values are objects
        const isOldValueObject = oldValue instanceof Object;
        const isNewValueObject = newValue instanceof Object;

        let areDifferent = false;

        if (isOldValueDate && isNewValueDate) {
          areDifferent = oldValue.getTime() !== newValue.getTime();
        } else if (isOldValueObject && isNewValueObject) {
          areDifferent = JSON.stringify(oldValue) !== JSON.stringify(newValue);
        } else {
          areDifferent = oldValue != newValue;
        }

        if (areDifferent) {
          acc.push({
            table,
            field,
            prev: oldValue as string | number | null,
            updated: newValue as string | number | null,
          });
        }

        return acc;
      }, []);
    });
  }

  /**
   * Filters changes into categories: profile, eligibility, and wellness plan.
   */
  private static filterChanges(changes: Change[]): FilteredChanges {
    return changes.reduce<FilteredChanges>(
      (acc, change) => {
        const section = fieldMap[`${change.table}_${change.field}`]?.section;

        if (section === AUDIT_SECTIONS_ENUM.CHANGES_TO_PROFILE) {
          acc.profileChanges.push(change);
        } else if (section === AUDIT_SECTIONS_ENUM.ELIGIBILITY) {
          acc.eligibilityChanges.push(change);
        } else if (section === AUDIT_SECTIONS_ENUM.WELLNESS_PLAN) {
          acc.wellnessPlanChanges.push(change);
        } else if (section === AUDIT_SECTIONS_ENUM.TODO) {
          acc.todoChanges.push(change);
        } else if (section === AUDIT_SECTIONS_ENUM.MEMBER_SURVEYS) {
          acc.memberSurveyChanges.push(change);
        } else if (section === AUDIT_SECTIONS_ENUM.SMS_AND_CALLS) {
          acc.smsAndCallChanges.push(change);
        } else if (section === AUDIT_SECTIONS_ENUM.MIX_PANEL_EVENTS) {
          acc.mixPanelEventChanges.push(change);
        }

        return acc;
      },
      {
        profileChanges: [],
        eligibilityChanges: [],
        wellnessPlanChanges: [],
        todoChanges: [],
        memberSurveyChanges: [],
        smsAndCallChanges: [],
        mixPanelEventChanges: [],
      },
    );
  }

  /**
   * Creates an audit record for events.
   */
  private static async auditEvent(params: AuditParams) {
    const changesToAudit: ChangeToAudit[] = [];

    if (
      params.action === EVENT_TYPE_ENUM.PROFILE_BIO_APPROVED ||
      params.action === EVENT_TYPE_ENUM.PROFILE_BIO_REJECTED
    ) {
      changesToAudit.push(
        {
          mapping_id: params.action,
          field: "bio",
          prev: null,
          updated: params.changes[0]?.newRecord.bio as string,
        },
        {
          mapping_id: params.action,
          field: "updatedDate",
          prev: null,
          updated: params.changes[0]?.newRecord.updatedDate as string,
        },
      );

      if (params.action === EVENT_TYPE_ENUM.PROFILE_BIO_REJECTED) {
        changesToAudit.push(
          {
            mapping_id: params.action,
            field: "tags",
            prev: null,
            updated: params.changes[0]?.newRecord.tags as string,
          },
          {
            mapping_id: params.action,
            field: "supportChatMessage",
            prev: null,
            updated: params.changes[0]?.newRecord.supportChatMessage as string,
          },
        );
      }
    }
    await AuditDAL.insertAuditRecord({
      eventType: params.action,
      section: params.section,
      userId: params.targetUser,
      associatedPeerId: params.actorId,
      changes: changesToAudit ?? [],
      references: params.references,
    });
  }

  private static separateTableAndColumnFromField(field: string) {
    const [table, column] = field.split(".");
    if (!table || !column) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Field Name not in expected format",
      });
    }
    return { table, column };
  }

  private static async handlePeersPeerId(change: ChangeToAudit) {
    if (typeof change.prev === "string" && change.prev) {
      const id = Number(change.prev.split("-")[0]);
      change.prev = (await UsersDAL.getUserById(id))?.username ?? "";
    }
    if (typeof change.updated === "string" && change.updated) {
      const id = Number(change.updated.split("-")[0]);
      change.updated = (await UsersDAL.getUserById(id))?.username ?? "";
    }
  }

  private static async handleTerritoryId(change: ChangeToAudit) {
    if (change.prev) {
      const [site] = await TerritoriesDAL.getTerritoryById(Number(change.prev));
      change.prev = site ? site.name : change.prev;
    }
    if (change.updated) {
      const [site] = await TerritoriesDAL.getTerritoryById(Number(change.updated));
      change.updated = site ? site.name : change.updated;
    }
  }

  private static async handleSiteId(change: ChangeToAudit) {
    if (change.prev) {
      const [site] = await SitesDAL.getSiteById(Number(change.prev));
      change.prev = site ? site.name : change.prev;
    }
    if (change.updated) {
      const [site] = await SitesDAL.getSiteById(Number(change.updated));
      change.updated = site ? site.name : change.updated;
    }
  }
}
