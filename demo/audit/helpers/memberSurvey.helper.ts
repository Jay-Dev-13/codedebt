import { TRPCError } from "@trpc/server";
import dayjs from "dayjs";
import advancedFormat from "dayjs/plugin/advancedFormat";
import relativeTime from "dayjs/plugin/relativeTime";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";

import { USER_ROLES } from "@marigold/db";

import type { audit } from "../../../../db/src/schema/audit";
import type { formDefinitions } from "../../../../db/src/schema/form_definitions";
import type { users } from "../../../../db/src/schema/users";
import type { FormQuestionDefinition } from "../../forms/formDefinition/schemas";
import type {
  FormQuestionResponse,
  FormResponseAmendmentHistory,
  FormResponseCustomData,
} from "../../forms/formResponse/types";
import type { AuditQueryResponse, AuditReference } from "../constants";
import { formKeyEnum } from "../../../../db/src/schema/form_definitions";
import { FormDefinitionDAL } from "../../forms/formDefinition/index";
import { FormQuestionType } from "../../forms/formDefinition/schemas";
import { FormResponseDAL } from "../../forms/formResponse/index";
import { RewardsService } from "../../rewards/service";
import { UsersDAL } from "../../user/dal";
import { EVENT_TYPE_ENUM, ICON_ENUM } from "../constants";

interface CustomDataValue {
  formInstanceNumber: number;
  [key: string]: unknown;
}

interface AmendmentAudit {
  title: string;
  enrichedAmendment: {
    questionNumber: number;
    questionKey: string;
    question: string;
    prev:
      | {
          scalar?: number;
          text?: string;
          singleSelect?: {
            selectedKey: string;
            value?: number;
            displayText?: string;
          };
          multipleSelect?: {
            selectedKeys: string[];
            displayText?: (string | undefined)[];
          };
          date?: string;
        }
      | undefined;
    updated:
      | {
          scalar?: number;
          text?: string;
          singleSelect?: {
            selectedKey: string;
            value?: number;
            displayText?: string;
          };
          multipleSelect?: {
            selectedKeys: string[];
            displayText?: (string | undefined)[];
          };
          date?: string;
        }
      | undefined;
  }[];
  amendedBy: string | undefined;
}

export class MemberSurveyHelper {
  static async handleMemberSurveyChanges(
    record: typeof audit.$inferSelect,
    actor: string,
  ): Promise<AuditQueryResponse> {
    const formDefinitionId = this.getReference(record.references, "formDefinitions");
    const formResponseId = this.getReference(record.references, "formResponses");

    let response;
    try {
      response = await FormResponseDAL.getById(Number(formResponseId));
    } catch (error) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Invalid Reference Encountered!",
      });
    }
    const responder = (await UsersDAL.getUserById(response.responderId))?.username;

    const definition = await this.getDefinition(formDefinitionId);

    const enrichedResponses = this.getEnrichedResponse(response.responses, definition);
    const { title, points } = this.generateMemberSurveysTitleAndPoints(response, definition, actor);

    const { reviewNote, reviewStatus } = await this.generateReviewNoteAndStatus(response.id);

    return {
      id: record.id,
      icon: ICON_ENUM.FORM,
      eventType: record.eventType,
      occurredAt: record.occurredAt,
      title: title,
      values: [
        {
          field: "response",
          prev: "",
          updated: JSON.stringify(enrichedResponses),
          type: EVENT_TYPE_ENUM.FORM_FILLED_EVENT,
        },
        {
          field: "responseId",
          prev: "",
          updated: response.id.toString(),
          type: EVENT_TYPE_ENUM.FORM_FILLED_EVENT,
        },
        {
          field: "reviewNote",
          prev: "",
          updated: reviewNote,
          type: EVENT_TYPE_ENUM.FORM_FILLED_EVENT,
        },
        {
          field: "reviewStatus",
          prev: "",
          updated: !["nps", "signup_form"].includes(definition.formKey) ? reviewStatus : "",
          type: EVENT_TYPE_ENUM.FORM_FILLED_EVENT,
        },
        {
          field: "formKey",
          prev: "",
          updated: definition.formKey,
          type: EVENT_TYPE_ENUM.FORM_FILLED_EVENT,
        },
        {
          field: "filledBy",
          prev: "",
          updated: responder ?? "Unknown",
          type: EVENT_TYPE_ENUM.FORM_FILLED_EVENT,
        },
        {
          field: "score",
          prev: "",
          updated: points?.toString() ?? "",
          type: EVENT_TYPE_ENUM.FORM_FILLED_EVENT,
        },
      ],
    };
  }

  static async handleStaffNoteChanges(
    record: typeof audit.$inferSelect,
    actor: string,
    userRole: USER_ROLES,
  ): Promise<AuditQueryResponse> {
    const formDefinitionId = this.getReference(record.references, "formDefinitions");
    const formResponseId = this.getReference(record.references, "formResponses");

    const definition = await this.getDefinition(formDefinitionId);

    const response = await FormResponseDAL.getById(Number(formResponseId));
    const enrichedResponses = this.getEnrichedResponse(response.responses, definition);

    const title = this.generateStaffNoteTitle(definition, response, actor);
    const isFormAmended = response.amendmentHistory.length !== 0;
    let amendmentAudit: AmendmentAudit[] = [];
    if (isFormAmended) {
      amendmentAudit = await this.getAmendmentAudit(response.amendmentHistory, definition);
    }

    return {
      id: record.id,
      icon: ICON_ENUM.FORM,
      eventType: record.eventType,
      occurredAt: record.occurredAt,
      title: title,
      values: [
        {
          field: "response",
          prev: "",
          updated: JSON.stringify(enrichedResponses),
          type: EVENT_TYPE_ENUM.REVIEW_FILLED_EVENT,
        },
        {
          field: "responseId",
          prev: "",
          updated: response.id.toString(),
          type: EVENT_TYPE_ENUM.REVIEW_FILLED_EVENT,
        },
        {
          field: "formKey",
          prev: "",
          updated: definition.formKey,
          type: EVENT_TYPE_ENUM.REVIEW_FILLED_EVENT,
        },
        {
          field: "amendments",
          prev: "",
          updated: JSON.stringify(amendmentAudit),
          type: EVENT_TYPE_ENUM.REVIEW_FILLED_EVENT,
        },
        {
          field: "amendmentStatus",
          prev: "",
          updated: isFormAmended
            ? `Amended by ${amendmentAudit[amendmentAudit.length - 1]!.amendedBy}`
            : "",
          type: EVENT_TYPE_ENUM.REVIEW_FILLED_EVENT,
        },
        {
          field: "amendable",
          prev: "",
          updated:
            userRole === USER_ROLES.superAdmin &&
            dayjs().diff(dayjs(response.createdAt), "days") < 45
              ? "true"
              : "false",
          type: EVENT_TYPE_ENUM.REVIEW_FILLED_EVENT,
        },
      ],
    };
  }

  static formatDateToET(date: Date): string {
    dayjs.extend(utc);
    dayjs.extend(timezone);
    dayjs.extend(relativeTime);
    dayjs.extend(advancedFormat);
    return date ? dayjs(date).tz("America/New_York").format("MM/DD/YYYY, hh:mm A [ET]") : " ";
  }

  static getEnrichedAmendment(
    amendmentChanges: {
      previousResponse: FormQuestionResponse;
      newResponse: FormQuestionResponse;
    }[],
    definition: typeof formDefinitions.$inferSelect,
  ) {
    return amendmentChanges.map((change) =>
      this.formatAmendment(change.previousResponse, change.newResponse, definition),
    );
  }

  static getEnrichedResponse(
    rawResponses: FormQuestionResponse[],
    definition: typeof formDefinitions.$inferSelect,
  ) {
    return rawResponses.map((response) => this.formatResponse(response, definition));
  }

  // Utility function to format amendments
  private static formatAmendment(
    previousResponse: FormQuestionResponse,
    newResponse: FormQuestionResponse,
    definition: typeof formDefinitions.$inferSelect,
  ) {
    const { question, questionIndex } = this.findQuestionByKey(newResponse.questionKey, definition);

    if (previousResponse.answer) {
      this.enrichAnswer(question, previousResponse);
    }
    if (newResponse.answer) {
      this.enrichAnswer(question, newResponse);
    }

    return {
      question: question.primaryQuestionText,
      questionNumber: questionIndex + 1,
      questionKey: question.questionKey,
      prev: previousResponse.answer,
      updated: newResponse.answer,
    };
  }

  // Utility function to format responses
  private static formatResponse(
    response: FormQuestionResponse,
    definition: typeof formDefinitions.$inferSelect,
  ) {
    const { question } = this.findQuestionByKey(response.questionKey, definition);
    if (response.answer) {
      this.enrichAnswer(question, response);
    }
    return {
      question: question.primaryQuestionText,
      additionalHelpText: question.helperMessage ? question.helperMessage : null,
      answer: response.answer,
    };
  }

  // Utility function to find question by key
  private static findQuestionByKey(
    questionKey: string,
    definition: typeof formDefinitions.$inferSelect,
  ): {
    question: FormQuestionDefinition;
    questionIndex: number;
  } {
    const questionIndex = definition.questions.findIndex((q) => q.questionKey === questionKey);
    const question = definition.questions[questionIndex];
    if (!question) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: `Question with key ${questionKey} not found in definition`,
      });
    }
    return { question, questionIndex };
  }

  // Utility function to handle single select question answer enrichment
  private static enrichSingleSelectAnswer(
    question: (typeof formDefinitions.$inferSelect)["questions"][number],
    response: FormQuestionResponse,
  ) {
    const selectedChoice = question.config.singleSelect!.choices.find(
      (choice) => choice.key === response.answer!.singleSelect?.selectedKey,
    );
    response.answer!.singleSelect!.displayText = selectedChoice?.displayText ?? "";
  }

  // Utility function to handle multiple select question answer enrichment
  private static enrichMultipleSelectAnswer(
    question: (typeof formDefinitions.$inferSelect)["questions"][number],
    response: FormQuestionResponse,
  ) {
    const selectedChoices = question.config.multipleSelect!.choices.reduce((acc, curr) => {
      if (response.answer!.multipleSelect?.selectedKeys.includes(curr.key)) {
        acc.push(curr.displayText);
      }
      return acc;
    }, [] as string[]);
    response.answer!.multipleSelect!.selectedKeys = selectedChoices;
  }

  // Utility function to enrich answers based on question type
  private static enrichAnswer(
    question: (typeof formDefinitions.$inferSelect)["questions"][number],
    response: FormQuestionResponse,
  ) {
    if (question.questionType === FormQuestionType.SingleSelect) {
      this.enrichSingleSelectAnswer(question, response);
    } else if (question.questionType === FormQuestionType.MultipleSelect) {
      this.enrichMultipleSelectAnswer(question, response);
    }
  }

  static getReference(reference: AuditReference[], table: string): string | number {
    const value = reference.find((ref) => ref.table === table)?.value;

    if (!value) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: `${table} reference not found in Audit`,
      });
    }
    return value;
  }

  static async getDefinition(id: string | number): Promise<typeof formDefinitions.$inferSelect> {
    const definition = await FormDefinitionDAL.getById(Number(id));

    if (!definition) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Definition not found in Audit",
      });
    }
    return definition;
  }

  static generateMemberSurveysTitleAndPoints(
    response: {
      id: number;
      createdAt: Date;
      formId: number;
      customData: FormResponseCustomData;
      responses: FormQuestionResponse[];
      amendmentHistory: FormResponseAmendmentHistory;
    },
    definition: typeof formDefinitions.$inferSelect,
    actor: string,
  ) {
    let title = `${definition.displayName} completed by ${actor}`;
    let points: number | undefined;
    if (
      [formKeyEnum.BARC10, formKeyEnum.MHRM, formKeyEnum.PWI].includes(
        definition.formKey as formKeyEnum,
      )
    ) {
      const customData = response.customData as Record<string, CustomDataValue>;
      points = customData[definition.formKey]?.points as number | undefined;
      const version = customData[definition.formKey]?.formInstanceNumber;
      const ordinal = version ? RewardsService.getOrdinal(version) : "";
      title = `${ordinal}${title} (${points?.toString()} points)`;
    }

    return { title, points };
  }

  static generateStaffNoteTitle(
    definition: typeof formDefinitions.$inferSelect,
    response: {
      id: number;
      createdAt: Date;
      formId: number;
      customData: FormResponseCustomData;
      responses: FormQuestionResponse[];
      amendmentHistory: FormResponseAmendmentHistory;
    },
    actor: string,
  ) {
    let title = `${definition.displayName} v${definition.formVersion} by ${actor}`;

    if (
      [
        formKeyEnum.BARC10_REVIEW_NOTE,
        formKeyEnum.PWI_SURVEY_REVIEW_NOTE,
        formKeyEnum.MHRM_REVIEW_NOTE,
      ].includes(definition.formKey as formKeyEnum)
    ) {
      const customData = response.customData as Record<string, CustomDataValue>;
      const version = customData[definition.formKey]?.formInstanceNumber;
      const ordinal = version ? RewardsService.getOrdinal(version) : "";
      title = ordinal + title;
    }

    return title;
  }

  static async generateReviewNoteAndStatus(reviewId: number): Promise<{
    reviewNote: string;
    reviewStatus: string;
  }> {
    const review = await FormResponseDAL.getReview(reviewId);
    let reviewNote = "";
    let reviewer: typeof users.$inferSelect | undefined;
    let reviewerUsername = "Unknown";
    if (review) {
      reviewer = await UsersDAL.getUserById(review.associatedPeerUserId!);
      if (reviewer) {
        reviewerUsername = reviewer.username;
      }
      reviewNote = `Reviewed by ${reviewerUsername} at ${this.formatDateToET(review.createdAt)}`;
    }
    const reviewStatus = review ? `Reviewed by ${reviewerUsername}` : "Needs Review";
    return { reviewNote, reviewStatus };
  }

  static async getAmendmentAudit(
    amendmentHistory: FormResponseAmendmentHistory,
    definition: typeof formDefinitions.$inferSelect,
  ): Promise<AmendmentAudit[]> {
    return Promise.all(
      amendmentHistory.map(async (amendmentRecord) => {
        const amendedBy = amendmentRecord.amenderUserId
          ? (await UsersDAL.getUserById(amendmentRecord.amenderUserId))?.username
          : undefined;

        const title = `Amended by ${amendedBy ?? "Unknown"} at ${this.formatDateToET(new Date(amendmentRecord.amendedAt))}`;
        const enrichedAmendment = this.getEnrichedAmendment(
          amendmentRecord.amendmentSet,
          definition,
        );
        return {
          title,
          enrichedAmendment,
          amendedBy,
        };
      }),
    );
  }
}
