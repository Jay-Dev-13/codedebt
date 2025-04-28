import { schema } from "@marigold/db";

import type { audit } from "../../../../db/src/schema/audit";
import type {
  AuditQueryResponse,
  AuditReference,
  Change,
  ChangeToAudit,
  EVENT_TYPE_ENUM,
} from "../constants";
import { RewardsDAL } from "../../rewards/dal";
import { AUDIT_SECTIONS_ENUM, CHANGE_TYPE_ENUM, fieldMap, ICON_ENUM } from "../constants";
import { AuditDAL } from "../dal";
import { AuditService } from "../service";

export class TodoHelper {
  /**
   * Creates Audit record for changes related to Rewards section
   *
   * @param input - Object containing the details of the audit, including action type, actor ID, target user, columns with changes, and references.
   */
  static async auditTodoChanges(input: {
    action: EVENT_TYPE_ENUM | CHANGE_TYPE_ENUM;
    actorId?: number;
    targetUser: number;
    columns: Change[];
    references: AuditReference[];
  }) {
    const changes: ChangeToAudit[] = input.columns.map((column) => ({
      mapping_id:
        fieldMap[`${column.table}_${column.field}`]?.type ?? CHANGE_TYPE_ENUM.REWARD_COMPLETED,
      field: `${column.table}.${column.field}`,
      prev: column.prev ?? "",
      updated: column.updated ?? "",
    }));

    if (changes.length > 0) {
      await AuditDAL.insertAuditRecord({
        userId: input.targetUser,
        associatedPeerId: input.actorId,
        eventType: input.action,
        section: AUDIT_SECTIONS_ENUM.TODO,
        changes,
        references: input.references,
      });
    }
  }

  /**
   * Handles changes related to rewards, such as completion, redemption, or creation of custom rewards.
   *
   * @param record - The audit record containing event details.
   * @param actor - The name of the person who made the change.
   * @returns A formatted response for the audit timeline.
   */
  static async handleTodoChanges(
    record: typeof audit.$inferSelect,
    actor: string,
  ): Promise<AuditQueryResponse> {
    switch (record.eventType) {
      case CHANGE_TYPE_ENUM.REWARD_COMPLETED:
        return this.handleRewardCompletedEvent(record, actor);
      case CHANGE_TYPE_ENUM.REWARD_REDEEMED:
        return this.handleRewardRedeemedEvent(record, actor);
      case CHANGE_TYPE_ENUM.CUSTOM_REWARD_CREATED:
        return this.handleCustomRewardCreatedEvent(record, actor);
      case CHANGE_TYPE_ENUM.REWARD_CHANGE:
        return record.changes.length === 1
          ? AuditService.handleFieldChange(record, record.changes[0]!, actor)
          : AuditService.handleDefaultBatchChange(record, record.changes, actor);
      default:
        return AuditService.handleDefaultBatchChange(record, record.changes, actor);
    }
  }

  /**
   * Handles the event where a reward is marked as completed.
   *
   * @param record - The audit record containing event details.
   * @param actor - The name of the person who completed the reward.
   * @returns A formatted response for the audit timeline.
   */
  private static async handleRewardCompletedEvent(
    record: typeof audit.$inferSelect,
    actor: string,
  ) {
    const rewardScheduleId = this.getReferenceValue(record.references, "rewardsSchedule");

    const userCompletedRewardsId = this.getReferenceValue(
      record.references,
      "userCompletedRewards",
    );

    const rewardAmount = this.getChangeValue(
      record.changes,
      schema.userCompletedRewards.amount.name,
    );

    const scheduleType = await this.getScheduleType(rewardScheduleId);

    const { oldBalance, newBalance } = await this.calculateBalances(
      userCompletedRewardsId,
      Number(rewardAmount),
    );

    return {
      id: record.id,
      eventType: record.eventType,
      icon: ICON_ENUM.REWARD_COMPLETED,
      title: `$${(Number(rewardAmount) / 100)?.toString()} ${scheduleType} reward completed by ${actor}`,
      values: [
        {
          field: "Balance",
          type: CHANGE_TYPE_ENUM.REWARD_COMPLETED,
          prev: oldBalance.toString(),
          updated: newBalance.toString(),
        },
      ],
      occurredAt: record.occurredAt,
    };
  }

  /**
   * Handles the event where a reward is redeemed, updating the balance accordingly.
   *
   * @param record - The audit record containing event details.
   * @param actor - The name of the person who redeemed the reward.
   * @returns A formatted response for the audit timeline.
   */
  private static async handleRewardRedeemedEvent(
    record: typeof audit.$inferSelect,
    actor: string,
  ): Promise<AuditQueryResponse> {
    const amountRedeemed = this.getChangeValue(record.changes, "amount");
    const newBalance = this.getChangeValue(record.changes, "balance");

    const oldBalance = Number(amountRedeemed) + Number(newBalance);

    return {
      id: record.id,
      eventType: record.eventType,
      icon: ICON_ENUM.REWARD_REDEEMED,
      title: `$${(Number(amountRedeemed) / 100).toString()} redeemed by ${actor}`,
      occurredAt: record.occurredAt,
      values: [
        {
          field: "Balance",
          type: CHANGE_TYPE_ENUM.REWARD_REDEEMED,
          prev: oldBalance.toString(),
          updated: newBalance.toString(),
        },
      ],
    };
  }

  /**
   * Handles the event where a custom reward is created.
   *
   * @param record - The audit record containing event details.
   * @param actor - The name of the person who created the custom reward.
   * @returns A formatted response for the audit timeline.
   */
  private static async handleCustomRewardCreatedEvent(
    record: typeof audit.$inferSelect,
    actor: string,
  ): Promise<AuditQueryResponse> {
    const { amount, title } = record.changes.reduce(
      (acc, current) => this.accumulateRewardChanges(acc, current),
      { amount: 0, title: "" },
    );

    return {
      id: record.id,
      eventType: record.eventType,
      icon: ICON_ENUM.CUSTOM_REWARD_CREATED,
      title: `Custom reward of amount: $${(amount / 100)?.toString()} and name: "${title}" created by ${actor}`,
      values: [],
      occurredAt: record.occurredAt,
    };
  }

  // ------------------ Utility methods -------------------

  /**
   * Retrieves the value of a reference from the list of audit references.
   *
   * @param references - The list of references associated with the audit record.
   * @param table - The table name to match against the reference list.
   * @returns The value associated with the given table in the references, or undefined if not found.
   */
  private static getReferenceValue(
    references: AuditReference[],
    table: string,
  ): string | number | undefined {
    return references.find((reference) => reference.table === table)?.value;
  }

  /**
   * Retrieves the type of the reward schedule based on the rewardScheduleId.
   *
   * @param rewardScheduleId - The ID of the reward schedule.
   * @returns The title of the reward schedule, or "Unknown Reward Type" if not found.
   */
  private static async getScheduleType(rewardScheduleId?: string | number): Promise<string> {
    if (!rewardScheduleId) return "Unknown Reward Type";
    const [schedule] = await RewardsDAL.getRewardsScheduleById(Number(rewardScheduleId));
    return schedule?.title ?? "Unknown Reward Type";
  }

  /**
   * Retrieves the updated value of a specific field from the list of changes.
   *
   * @param changes - The list of changes associated with the audit record.
   * @param fieldName - The field name to match against the changes list.
   * @returns The updated value of the field, or an empty string if not found.
   */
  private static getChangeValue(changes: ChangeToAudit[], fieldName: string): string | number {
    return changes.find((change) => change.field.split(".")[1] === fieldName)?.updated ?? "";
  }

  /**
   * Calculates the old and new balances based on a transaction ID and reward amount.
   *
   * @param userCompletedRewardsId - The ID of the completed rewards transaction.
   * @param rewardAmount - The amount of the reward to subtract from the balance.
   * @returns An object containing the old and new balances.
   */
  private static async calculateBalances(
    userCompletedRewardsId?: number | string,
    rewardAmount?: number,
  ): Promise<{ oldBalance: number; newBalance: number }> {
    if (!userCompletedRewardsId) {
      return { oldBalance: 0, newBalance: 0 };
    }

    const [transaction] = await RewardsDAL.getCreditTransactionByUserCompletedRewardsId(
      Number(userCompletedRewardsId),
    );
    const newBalance = transaction?.balance ?? 0;
    const oldBalance = newBalance - (rewardAmount ?? 0);

    return { oldBalance, newBalance };
  }

  /**
   * Accumulates the changes related to a custom reward, updating the amount and title.
   *
   * @param acc - The accumulator object storing the amount and title of the reward.
   * @param current - The current change being processed.
   * @returns The updated accumulator object.
   */
  private static accumulateRewardChanges(
    acc: { amount: number; title: string },
    current: ChangeToAudit,
  ) {
    const field = current.field.split(".")[1];
    if (field === "amountForEnrolled") acc.amount = Number(current.updated);
    if (field === "title") acc.title = current.updated?.toString() ?? "";
    return acc;
  }
}
