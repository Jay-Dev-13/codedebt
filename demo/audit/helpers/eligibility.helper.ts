import type { audit } from "../../../../db/src/schema/audit";
import type {
  AuditQueryResponse,
  AuditReference,
  Change,
  ChangeToAudit,
  EVENT_TYPE_ENUM,
} from "../constants";
import { AUDIT_SECTIONS_ENUM, CHANGE_TYPE_ENUM, fieldMap } from "../constants";
import { AuditDAL } from "../dal";
import { AuditService } from "../service";

export class EligibilityHelper {
  /**
   * Creates an audit record for eligibility section.
   */
  static async auditEligibilityChanges(input: {
    action: EVENT_TYPE_ENUM | CHANGE_TYPE_ENUM;
    actorId?: number;
    targetUser: number;
    columns: Change[];
    references: AuditReference[];
  }) {
    const changes: ChangeToAudit[] = input.columns.map((column) => ({
      mapping_id:
        fieldMap[`${column.table}_${column.field}`]?.type ?? CHANGE_TYPE_ENUM.FIELD_CHANGE,
      field: `${column.table}.${column.field}`,
      prev: column.prev?.toString() ?? "",
      updated: column.updated?.toString() ?? "",
    }));

    if (changes.length > 0) {
      const record = {
        userId: input.targetUser,
        associatedPeerId: input.actorId,
        eventType: input.action,
        section: AUDIT_SECTIONS_ENUM.ELIGIBILITY,
        changes,
        references: input.references,
      };

      await AuditDAL.insertAuditRecord(record);
    }
  }

  static async handleEligibilityChanges(
    record: typeof audit.$inferSelect,
    actor: string,
  ): Promise<AuditQueryResponse> {
    return AuditService.handleDefaultBatchChange(record, record.changes, actor);
  }
}
