import { TRPCError } from "@trpc/server";

import type { audit } from "../../../../db/src/schema/audit";
import type { milestones } from "../../../../db/src/schema/milestones";
import type { StrengthsAndObstaclesValue } from "../../../../db/src/schema/strengths_obstacles";
import type {
  AuditQueryResponse,
  AuditReference,
  Change,
  ChangeToAudit,
  ChangeToDisplay,
} from "../constants";
import { MILESTONE_STATUS_ENUM } from "../../constants/api.constants";
import { GoalsDAL, MilestonesDAL } from "../../wellnessJourney/dal";
import {
  AUDIT_SECTIONS_ENUM,
  CHANGE_TYPE_ENUM,
  EVENT_TYPE_ENUM,
  fieldMap,
  ICON_ENUM,
} from "../constants";
import { AuditDAL } from "../dal";
import { AuditService } from "../service";

export class WellnessJourneyHelper {
  /**
   * Creates an audit record for wellness plan section.
   */
  static async auditWellnessChanges(input: {
    action: EVENT_TYPE_ENUM | CHANGE_TYPE_ENUM;
    actorId?: number;
    targetUser: number;
    columns: Change[];
    references: AuditReference[];
  }) {
    if (
      [CHANGE_TYPE_ENUM.MILESTONE_ADDED, CHANGE_TYPE_ENUM.MILESTONE_CHANGE].includes(
        input.action as CHANGE_TYPE_ENUM,
      )
    ) {
      const milestoneId = Number(
        (input.references as { table: string; field: string; value: string | number }[]).filter(
          (ref) => ref.table === "milestones" && ref.field === "id",
        )[0]?.value,
      );

      if (!milestoneId)
        throw new TRPCError({ code: "UNPROCESSABLE_CONTENT", message: "Reference not found." });

      const [milestone] = await MilestonesDAL.fetchMilestoneWithId(milestoneId);
      const record = {
        userId: input.targetUser,
        associatedPeerId: input.actorId,
        eventType: input.action,
        section: AUDIT_SECTIONS_ENUM.WELLNESS_PLAN,
        changes: [
          {
            mapping_id: input.action,
            field: "milestones.event",
            prev: "",
            updated: JSON.stringify({
              id: milestone?.id,
              name: milestone?.name,
              description: milestone?.description,
              status: milestone?.status,
              event: milestone?.event,
              createdAt: milestone?.createdAt,
            }),
          },
        ],
        references: input.references,
      };
      await AuditDAL.insertAuditRecord(record);
      return;
    }

    const changes: ChangeToAudit[] = input.columns.map((column) => ({
      mapping_id: fieldMap[`${column.table}_${column.field}`]?.type ?? CHANGE_TYPE_ENUM.GOAL_CHANGE,
      field: `${column.table}.${column.field}`,
      prev:
        input.action === CHANGE_TYPE_ENUM.STRENGTH_AND_OBSTACLE_ADDED ||
        input.action === CHANGE_TYPE_ENUM.STRENGTH_AND_OBSTACLE_CHANGE
          ? JSON.stringify(column.prev ?? {})
          : (column.prev ?? ""),
      updated:
        input.action === CHANGE_TYPE_ENUM.STRENGTH_AND_OBSTACLE_ADDED ||
        input.action === CHANGE_TYPE_ENUM.STRENGTH_AND_OBSTACLE_CHANGE
          ? JSON.stringify(column.updated ?? {})
          : (column.updated ?? ""),
    }));

    if (changes.length > 0) {
      const record = {
        userId: input.targetUser,
        associatedPeerId: input.actorId,
        eventType: input.action,
        section: AUDIT_SECTIONS_ENUM.WELLNESS_PLAN,
        changes,
        references: input.references,
      };

      await AuditDAL.insertAuditRecord(record);
    }
  }

  static async handleWellnessJourneyChanges(
    record: typeof audit.$inferSelect,
    actor: string,
  ): Promise<AuditQueryResponse> {
    switch (record.eventType) {
      case EVENT_TYPE_ENUM.GOAL_ARCHIVED_EVENT:
        return {
          id: record.id,
          title: "Goal archived",
          eventType: record.eventType,
          icon: ICON_ENUM.EVENT_GENERIC,
          occurredAt: record.occurredAt,
          values: [],
        };
      case EVENT_TYPE_ENUM.GOAL_COMPLETED_EVENT:
        return {
          id: record.id,
          title: "Goal completed",
          eventType: record.eventType,
          icon: ICON_ENUM.EVENT_GENERIC,
          occurredAt: record.occurredAt,
          values: [],
        };
      case CHANGE_TYPE_ENUM.MILESTONE_ADDED:
        return this.handleMilestoneChange(record, record.changes[0]!, actor);
      case CHANGE_TYPE_ENUM.MILESTONE_CHANGE:
        return this.handleMilestoneChange(record, record.changes[0]!, actor);
      case CHANGE_TYPE_ENUM.STRENGTH_AND_OBSTACLE_CHANGE:
        return this.handleStrengthsAndObstaclesChange(record, record.changes[0]!, actor);
      case CHANGE_TYPE_ENUM.STRENGTH_AND_OBSTACLE_ADDED:
        return this.handleStrengthsAndObstaclesChange(record, record.changes[0]!, actor);
      case CHANGE_TYPE_ENUM.GOAL_CHANGE:
        return record.changes.length > 1
          ? this.handleGoalChange(record, record.changes[0]!, actor)
          : this.handleBatchGoalChange(record, record.changes, actor);
      case CHANGE_TYPE_ENUM.GOAL_ADDED:
        return this.handleBatchGoalChange(record, record.changes, actor);
      default:
        return AuditService.handleDefaultBatchChange(record, record.changes, actor);
    }
  }

  /**
   * Handles retrieval of strengths and obstacles events.
   */
  static async handleStrengthsAndObstaclesChange(
    record: typeof audit.$inferSelect,
    change: ChangeToAudit,
    actor: string,
  ): Promise<AuditQueryResponse> {
    const [table, column] = change.field.split(".");
    if (!table || !column) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Field Name not in expected format",
      });
    }

    let prevStrengths: string[] = [],
      prevObstacles: string[] = [];
    let updatedStrengths: string[] = [],
      updatedObstacles: string[] = [];

    if (change.prev) {
      ({ strengths: prevStrengths, obstacles: prevObstacles } = JSON.parse(
        change.prev.toString(),
      ) as StrengthsAndObstaclesValue);
    }
    if (change.updated) {
      ({ strengths: updatedStrengths, obstacles: updatedObstacles } = JSON.parse(
        change.updated.toString(),
      ) as StrengthsAndObstaclesValue);
    }

    const values = [];
    if (record.eventType === CHANGE_TYPE_ENUM.STRENGTH_AND_OBSTACLE_CHANGE) {
      values.push(...this.compareArrays("Strengths", prevStrengths, updatedStrengths));
      values.push(...this.compareArrays("Obstacles", prevObstacles, updatedObstacles));
    } else {
      values.push({
        field: "Strengths And Obstacles",
        prev: "",
        updated: change?.updated?.toString() ?? "",
        type: CHANGE_TYPE_ENUM.STRENGTH_AND_OBSTACLE_ADDED,
      });
    }

    return {
      id: record.id,
      title: `WP Strengths & Obstacles ${record.eventType === CHANGE_TYPE_ENUM.STRENGTH_AND_OBSTACLE_ADDED ? "added" : "updated"} by ${actor}`,
      occurredAt: record.occurredAt,
      eventType: record.eventType,
      icon: fieldMap[`${table}_${column}`]?.icon ?? ICON_ENUM.GOAL,
      values: values,
    };
  }

  /**
   * Handles single change for goal-change eventType.
   */
  static async handleGoalChange(
    record: typeof audit.$inferSelect,
    change: ChangeToAudit,
    actor: string,
  ): Promise<AuditQueryResponse> {
    const [table, column] = change.field.split(".");
    if (!table || !column)
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Field Name not in expected format",
      });

    const goalId = Number(
      (record.references as { table: string; field: string; value: string | number }[]).filter(
        (ref) => ref.table === "goals" && ref.field === "id",
      )[0]?.value,
    );

    if (!goalId) {
      throw new TRPCError({ code: "UNPROCESSABLE_CONTENT", message: "Reference not found." });
    }

    const [goal] = await GoalsDAL.getGoalById(goalId);

    return {
      id: record.id,
      title: `WP Goal "${goal?.name ?? ""}" Goal updated by ${actor}`,
      eventType: record.eventType,
      icon: fieldMap[`${table}_${column}`]?.icon ?? ICON_ENUM.GOAL,
      values: [
        {
          field: fieldMap[`${table}_${column}`]?.displayName ?? "Unknown Field",
          prev: change.prev?.toString() ?? "",
          updated: change.updated?.toString() ?? "",
          type: CHANGE_TYPE_ENUM.GOAL_CHANGE,
        },
      ],
      occurredAt: record.occurredAt,
    };
  }

  /**
   * Handles batch changes for goals.
   */
  static async handleBatchGoalChange(
    record: typeof audit.$inferSelect,
    changes: ChangeToAudit[],
    actor: string,
  ) {
    const goalId = Number(
      record.references.filter((ref) => ref.table === "goals" && ref.field === "id")[0]?.value,
    );

    if (!goalId) {
      throw new TRPCError({ code: "UNPROCESSABLE_CONTENT", message: "Reference not found." });
    }

    const [goal] = await GoalsDAL.fetchGoalWithId(goalId, record.userId);

    const values = changes.map((change) => {
      const [table, column] = change.field.split(".");
      if (!table || !column)
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Field Name not in expected format",
        });
      const mapData = fieldMap[`${table}_${column}`];

      return {
        field: mapData?.displayName ?? "Field",
        prev: change.prev?.toString() ?? "",
        updated: change.updated?.toString() ?? "",
        type: mapData?.type ?? CHANGE_TYPE_ENUM.FIELD_CHANGE,
      };
    });

    const isGoalUpdated = changes.some((change) => change.prev);

    return {
      id: record.id,
      eventType: record.eventType,
      icon: ICON_ENUM.GOAL,
      title: `WP Goal "${goal?.name ?? ""}" Goal ${isGoalUpdated ? "updated" : "added"} by ${actor}`,
      values,
      occurredAt: record.occurredAt,
    };
  }

  /**
   * Creates retrieval object for milestone related audit records.
   */
  static async handleMilestoneChange(
    record: typeof audit.$inferSelect,
    change: ChangeToAudit,
    actor: string,
  ): Promise<AuditQueryResponse> {
    let action = "updated";
    if (record.eventType === CHANGE_TYPE_ENUM.MILESTONE_ADDED) {
      action = "added";
    } else if (
      (JSON.parse(change.updated as string) as typeof milestones.$inferSelect).status ===
      MILESTONE_STATUS_ENUM.COMPLETED_MILESTONE
    ) {
      action = "completed";
    }
    return {
      id: record.id,
      eventType: record.eventType,
      icon: ICON_ENUM.BADGE,
      title: `Milestones ${action} in wellness plan by ${actor}`,
      values: [
        {
          field: "milestone",
          prev: "",
          updated: change.updated?.toString() ?? "",
          type: record.eventType,
        },
      ],
      occurredAt: record.occurredAt,
    };
  }

  // Compares the arrays of strengths and obstacles to prepare changes
  static compareArrays(
    field: "Strengths" | "Obstacles",
    prev: string[],
    newArr: string[],
  ): ChangeToDisplay[] {
    const maxLength = Math.max(prev.length, newArr.length);
    const result = [];

    for (let i = 0; i < maxLength; i++) {
      const prevValue = prev[i] ?? "";
      const newValue = newArr[i] ?? "";
      if (prevValue !== newValue) {
        result.push({
          field: field,
          prev: prevValue,
          updated: newValue,
          type: CHANGE_TYPE_ENUM.STRENGTH_AND_OBSTACLE_CHANGE,
        });
      }
    }

    return result;
  }
}
