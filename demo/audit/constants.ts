import type { PgColumn } from "drizzle-orm/pg-core";

import { schema } from "@marigold/db";

export enum ICON_ENUM {
  PROFILE = "Profile",
  BADGE = "Badge",
  ROLE = "Role",
  CONSENT_COMPLETE_EVENT = "ConsentCompleteEvent",
  DATE = "Date",
  EVENT_GENERIC = "EventGeneric",
  GROUP = "Group",
  TRACK = "Track",
  NOTES = "Notes",
  SITE = "Site",
  LOCATION = "Location",
  PEER = "Peer",
  LOGOUT_EVENT = "LogoutEvent",
  ACCOUNT_ARCHIVED_EVENT = "AccountArchivedEvent",
  DUPLICATE_ACCOUNT_EVENT = "DuplicateAccountEvent",
  BLACKLISTED_ACCOUNT_EVENT = "BlockedAccountEvent",
  FORCED_LOGOUT_EVENT = "ForcedLogoutEvent",
  CUSTOM_REWARD_CREATED = "CustomRewardCreated",
  REWARD_COMPLETED = "RewardCompleted",
  REWARD_REDEEMED = "RewardRedeemed",
  REWARD_CHANGE = "RewardChange",
  GOAL = "Goal",
  FORM = "Form",
  OTHER_PREFERENCE = "OtherPreference",
  EMAIL = "Email",
  CONTACT_NAME = "ContactName",
  CONTACT_RELATIONSHIP = "ContactRelationship",
  PRIMARY_VERIFICATION = "PrimaryVerification",
  CALL = "Call",
  SMS = "Sms",
  SUGGESTED_LOCATION = "SuggestedLocation",
}

export enum CHANGE_TYPE_ENUM {
  FIELD_CHANGE = "field-change",
  PEER_CHANGE = "peer-change",
  BADGE_CHANGE = "badge-change",
  GOAL_CHANGE = "goal-change",
  GOAL_ADDED = "goal-added",
  MILESTONE_ADDED = "milestone-added",
  MILESTONE_CHANGE = "milestone-change",
  STRENGTH_AND_OBSTACLE_CHANGE = "strength-and-obstacle-change",
  STRENGTH_AND_OBSTACLE_ADDED = "strength-and-obstacle-added",
  REWARD_COMPLETED = "reward-completed",
  BALANCE_REDEEMED = "balance-redeemed",
  CUSTOM_REWARD_CREATED = "custom-reward-created",
  REWARD_CHANGE = "reward-change",
  REWARD_REDEEMED = "reward-redeemed",
  USER_GROUP_STATUS_CHANGE = "user-group-status-change",
  SMS_AND_CALLS = "sms-and-calls",
  SMS = "sms",
  CALL_MADE = "call-made",
  CALL_RECEIVED = "call-received",
  USER_BLACKLISTED = "user-blacklisted",
  USER_UNDO_BLACKLISTED = "user-undo-blacklisted",
  MIX_PANEL_EVENT = "mix-panel-event",
}

export enum EVENT_TYPE_ENUM {
  SIGNUP_EVENT = "signup-event",
  SIGNIN_EVENT = "signin-event",
  LOGGED_OUT_EVENT = "logged-out-event",
  CONSENT_SIGNED_EVENT = "consent-signed-event",
  CONSENT_APPROVED_EVENT = "consent-approved-event",
  CONSENT_RESET_EVENT = "consent-reset-event",
  GOAL_COMPLETED_EVENT = "goal-completed-event",
  GOAL_ARCHIVED_EVENT = "goal-archived-event",
  FORM_FILLED_EVENT = "form-filled-event",
  REVIEW_FILLED_EVENT = "review-filled-event",
  USER_DISABLED_EVENT = "user-disabled-event",
  USER_ENABLED_EVENT = "user-enabled-event",
  ARCHIVED_ACCOUNT_EVENT = "archived-account-event",
  ACCOUNT_DELETED_EVENT = "account-deleted-event",
  USER_DUPLICATE_EVENT = "user-duplicate-event",
  USER_FORCE_LOGOUT_EVENT = "user-force-logout-event",
  ADD_USER_TO_GROUP_EVENT = "add-user-to-group-event",
  NEW_DM_CREATED_EVENT = "new-dm-created-event",
  DM_RESOLVED_EVENT = "dm-resolved-event",
  DM_OPENED_EVENT = "dm-opened-event",
  PROFILE_BIO_APPROVED = "profile-bio-approved",
  PROFILE_BIO_REJECTED = "profile-bio-rejected",
}

export enum AUDIT_SECTIONS_ENUM {
  ALL = "all",
  ALL_FORMS = "all_forms",
  MEMBER_SURVEYS = "member_surveys",
  STAFF_NOTES = "staff_notes",
  WELLNESS_PLAN = "wellness_plan",
  SMS_AND_CALLS = "sms_and_calls",
  ELIGIBILITY = "eligibility",
  CHANGES_TO_PROFILE = "changes_to_profile",
  TODO = "todo",
  MIX_PANEL_EVENTS = "mix_panel_event",
}

type prevChange = string | number | null;
type updatedChange = string | number | null;

export interface ChangeToAudit {
  mapping_id: CHANGE_TYPE_ENUM | EVENT_TYPE_ENUM;
  field: string;
  prev: prevChange;
  updated: updatedChange;
}

export interface ChangeToDisplay {
  type: string;
  field: string;
  prev: string;
  updated: string;
}

export interface Change {
  table: string;
  field: string;
  prev: prevChange;
  updated: updatedChange;
}

export interface RecordToCompare {
  table: string;
  oldRecord: Record<string, unknown>;
  newRecord: Record<string, unknown>;
}

export interface AuditReference {
  table: string;
  field: string;
  value: string | number;
}

export interface AuditParams {
  changes: RecordToCompare[];
  section: AUDIT_SECTIONS_ENUM;
  action: EVENT_TYPE_ENUM | CHANGE_TYPE_ENUM;
  actorId?: number;
  targetUser: number;
  references: AuditReference[];
  occurredAt?: string;
}

export interface AuditQueryResponse {
  id: number;
  title: string;
  occurredAt: Date;
  icon: string;
  eventType: string;
  values: ChangeToDisplay[];
}

export interface FilteredChanges {
  profileChanges: Change[];
  eligibilityChanges: Change[];
  wellnessPlanChanges: Change[];
  todoChanges: Change[];
  memberSurveyChanges: Change[];
  smsAndCallChanges: Change[];
  mixPanelEventChanges: Change[];
}

// Format for key is tableName_columnName (as named in the codebase). Fields listed here will be considered for changes
export const fieldMap: Record<
  string,
  {
    displayName: string;
    icon: ICON_ENUM;
    type: CHANGE_TYPE_ENUM;
    section: AUDIT_SECTIONS_ENUM;
    column: PgColumn | null;
  }
> = {
  users_username: {
    displayName: "Username",
    column: schema.users.username,
    icon: ICON_ENUM.PROFILE,
    type: CHANGE_TYPE_ENUM.FIELD_CHANGE,
    section: AUDIT_SECTIONS_ENUM.CHANGES_TO_PROFILE,
  },
  users_userRole: {
    displayName: "Type",
    column: schema.users.userRole,
    icon: ICON_ENUM.ROLE,
    type: CHANGE_TYPE_ENUM.FIELD_CHANGE,
    section: AUDIT_SECTIONS_ENUM.CHANGES_TO_PROFILE,
  },
  users_consentSignedBy: {
    displayName: "Consent Signed by",
    column: schema.users.consentSignedAt,
    icon: ICON_ENUM.CONSENT_COMPLETE_EVENT,
    type: CHANGE_TYPE_ENUM.FIELD_CHANGE,
    section: AUDIT_SECTIONS_ENUM.CHANGES_TO_PROFILE,
  },
  userInfos_firstName: {
    displayName: "First Name",
    column: schema.UserInfos.firstName,
    icon: ICON_ENUM.PROFILE,
    type: CHANGE_TYPE_ENUM.FIELD_CHANGE,
    section: AUDIT_SECTIONS_ENUM.CHANGES_TO_PROFILE,
  },
  userInfos_lastName: {
    displayName: "Last Name",
    column: schema.UserInfos.lastName,
    icon: ICON_ENUM.PROFILE,
    type: CHANGE_TYPE_ENUM.FIELD_CHANGE,
    section: AUDIT_SECTIONS_ENUM.CHANGES_TO_PROFILE,
  },
  userInfos_dob: {
    displayName: "Date of Birth",
    column: schema.UserInfos.dob,
    icon: ICON_ENUM.DATE,
    type: CHANGE_TYPE_ENUM.FIELD_CHANGE,
    section: AUDIT_SECTIONS_ENUM.CHANGES_TO_PROFILE,
  },
  userInfos_memberPronouns: {
    displayName: "Pronouns",
    column: schema.UserInfos.memberPronouns,
    icon: ICON_ENUM.PROFILE,
    type: CHANGE_TYPE_ENUM.FIELD_CHANGE,
    section: AUDIT_SECTIONS_ENUM.CHANGES_TO_PROFILE,
  },
  userInfos_preferredName: {
    displayName: "Preferred Name",
    column: schema.UserInfos.preferredName,
    icon: ICON_ENUM.PROFILE,
    type: CHANGE_TYPE_ENUM.FIELD_CHANGE,
    section: AUDIT_SECTIONS_ENUM.CHANGES_TO_PROFILE,
  },
  userInfos_memberTrack: {
    displayName: "Member Track",
    column: schema.UserInfos.memberTrack,
    icon: ICON_ENUM.TRACK,
    type: CHANGE_TYPE_ENUM.FIELD_CHANGE,
    section: AUDIT_SECTIONS_ENUM.CHANGES_TO_PROFILE,
  },
  userInfos_notes: {
    displayName: "Notes",
    column: schema.UserInfos.notes,
    icon: ICON_ENUM.NOTES,
    type: CHANGE_TYPE_ENUM.FIELD_CHANGE,
    section: AUDIT_SECTIONS_ENUM.CHANGES_TO_PROFILE,
  },
  userInfos_email: {
    displayName: "Email",
    column: schema.UserInfos.email,
    icon: ICON_ENUM.EMAIL,
    type: CHANGE_TYPE_ENUM.FIELD_CHANGE,
    section: AUDIT_SECTIONS_ENUM.CHANGES_TO_PROFILE,
  },
  userInfos_primaryVerification: {
    displayName: "Primary Verification",
    column: schema.UserInfos.primaryVerification,
    icon: ICON_ENUM.PRIMARY_VERIFICATION,
    type: CHANGE_TYPE_ENUM.FIELD_CHANGE,
    section: AUDIT_SECTIONS_ENUM.CHANGES_TO_PROFILE,
  },
  userInfos_contactPreferencesSms: {
    displayName: "SMS Preference",
    column: schema.UserInfos.contactPreferencesSms,
    icon: ICON_ENUM.SMS,
    type: CHANGE_TYPE_ENUM.FIELD_CHANGE,
    section: AUDIT_SECTIONS_ENUM.CHANGES_TO_PROFILE,
  },
  userInfos_contactPreferencesCalls: {
    displayName: "Call Preference",
    column: schema.UserInfos.contactPreferencesCalls,
    icon: ICON_ENUM.CALL,
    type: CHANGE_TYPE_ENUM.FIELD_CHANGE,
    section: AUDIT_SECTIONS_ENUM.CHANGES_TO_PROFILE,
  },
  userInfos_contactPreferencesOther: {
    displayName: "Other Contact Preferences",
    column: schema.UserInfos.contactPreferencesOther,
    icon: ICON_ENUM.OTHER_PREFERENCE,
    type: CHANGE_TYPE_ENUM.FIELD_CHANGE,
    section: AUDIT_SECTIONS_ENUM.CHANGES_TO_PROFILE,
  },
  userInfos_phoneNumber: {
    displayName: "Primary Number",
    column: schema.UserInfos.phoneNumber,
    icon: ICON_ENUM.CALL,
    type: CHANGE_TYPE_ENUM.FIELD_CHANGE,
    section: AUDIT_SECTIONS_ENUM.CHANGES_TO_PROFILE,
  },
  userInfos_secondaryPhoneNumber: {
    displayName: "Phone 2",
    column: schema.UserInfos.secondaryPhoneNumber,
    icon: ICON_ENUM.CALL,
    type: CHANGE_TYPE_ENUM.FIELD_CHANGE,
    section: AUDIT_SECTIONS_ENUM.CHANGES_TO_PROFILE,
  },
  userInfos_tertiaryPhoneNumber: {
    displayName: "Phone 3",
    column: schema.UserInfos.tertiaryPhoneNumber,
    icon: ICON_ENUM.CALL,
    type: CHANGE_TYPE_ENUM.FIELD_CHANGE,
    section: AUDIT_SECTIONS_ENUM.CHANGES_TO_PROFILE,
  },
  userInfos_emergencyContactName: {
    displayName: "Emergency Contact Name",
    column: schema.UserInfos.emergencyContactName,
    icon: ICON_ENUM.CONTACT_NAME,
    type: CHANGE_TYPE_ENUM.FIELD_CHANGE,
    section: AUDIT_SECTIONS_ENUM.CHANGES_TO_PROFILE,
  },
  userInfos_emergencyContactPhoneNumber: {
    displayName: "Emergency Contact Phone Number",
    column: schema.UserInfos.emergencyContactPhoneNumber,
    icon: ICON_ENUM.CALL,
    type: CHANGE_TYPE_ENUM.FIELD_CHANGE,
    section: AUDIT_SECTIONS_ENUM.CHANGES_TO_PROFILE,
  },
  userInfos_emergencyContactRelationship: {
    displayName: "Emergency Contact Relationship",
    column: schema.UserInfos.emergencyContactRelationship,
    icon: ICON_ENUM.CONTACT_RELATIONSHIP,
    type: CHANGE_TYPE_ENUM.FIELD_CHANGE,
    section: AUDIT_SECTIONS_ENUM.CHANGES_TO_PROFILE,
  },
  userInfos_suggestedLocation: {
    displayName: "Suggested Location",
    column: null,
    icon: ICON_ENUM.PROFILE,
    type: CHANGE_TYPE_ENUM.FIELD_CHANGE,
    section: AUDIT_SECTIONS_ENUM.CHANGES_TO_PROFILE,
  },
  peers_peerId: {
    displayName: "Peer",
    column: schema.peers.peerId,
    icon: ICON_ENUM.PEER,
    type: CHANGE_TYPE_ENUM.PEER_CHANGE,
    section: AUDIT_SECTIONS_ENUM.CHANGES_TO_PROFILE,
  },
  peers_type: {
    displayName: "Peer",
    column: schema.peers.type,
    icon: ICON_ENUM.PEER,
    type: CHANGE_TYPE_ENUM.PEER_CHANGE,
    section: AUDIT_SECTIONS_ENUM.CHANGES_TO_PROFILE,
  },
  groupUsers_pausedBy: {
    displayName: "Group Status",
    column: schema.groupUsers.pausedBy,
    icon: ICON_ENUM.GROUP,
    type: CHANGE_TYPE_ENUM.USER_GROUP_STATUS_CHANGE,
    section: AUDIT_SECTIONS_ENUM.CHANGES_TO_PROFILE,
  },
  groupUsers_activatedBy: {
    displayName: "Group Status",
    column: null,
    icon: ICON_ENUM.GROUP,
    type: CHANGE_TYPE_ENUM.USER_GROUP_STATUS_CHANGE,
    section: AUDIT_SECTIONS_ENUM.CHANGES_TO_PROFILE,
  },
  blackList_deviceId: {
    displayName: "Black Listed Device Id",
    column: null,
    icon: ICON_ENUM.BLACKLISTED_ACCOUNT_EVENT,
    type: CHANGE_TYPE_ENUM.FIELD_CHANGE,
    section: AUDIT_SECTIONS_ENUM.CHANGES_TO_PROFILE,
  },
  // --------------------------------- ELIGIBILITY FIELDS --------------------------------
  users_territoryId: {
    displayName: "State",
    column: schema.users.territoryId,
    icon: ICON_ENUM.SITE,
    type: CHANGE_TYPE_ENUM.FIELD_CHANGE,
    section: AUDIT_SECTIONS_ENUM.ELIGIBILITY,
  },
  users_badge: {
    displayName: "User Badge",
    column: schema.users.badge,
    icon: ICON_ENUM.BADGE,
    type: CHANGE_TYPE_ENUM.BADGE_CHANGE,
    section: AUDIT_SECTIONS_ENUM.ELIGIBILITY,
  },
  userInfos_provider: {
    displayName: "Provider",
    column: schema.UserInfos.provider,
    icon: ICON_ENUM.PROFILE,
    section: AUDIT_SECTIONS_ENUM.ELIGIBILITY,
    type: CHANGE_TYPE_ENUM.FIELD_CHANGE,
  },
  userInfos_providerId: {
    displayName: "Partner ID",
    column: schema.UserInfos.providerId,
    icon: ICON_ENUM.PROFILE,
    section: AUDIT_SECTIONS_ENUM.ELIGIBILITY,
    type: CHANGE_TYPE_ENUM.FIELD_CHANGE,
  },
  userInfos_partnerId: {
    displayName: "Partner ID",
    column: schema.UserInfos.partnerId,
    icon: ICON_ENUM.PROFILE,
    section: AUDIT_SECTIONS_ENUM.ELIGIBILITY,
    type: CHANGE_TYPE_ENUM.FIELD_CHANGE,
  },
  userInfos_primaryInsuranceId: {
    displayName: "Primary Insurance ID",
    column: schema.UserInfos.primaryInsuranceId,
    icon: ICON_ENUM.PROFILE,
    section: AUDIT_SECTIONS_ENUM.ELIGIBILITY,
    type: CHANGE_TYPE_ENUM.FIELD_CHANGE,
  },
  users_siteId: {
    displayName: "Site",
    column: schema.users.siteId,
    icon: ICON_ENUM.SITE,
    type: CHANGE_TYPE_ENUM.FIELD_CHANGE,
    section: AUDIT_SECTIONS_ENUM.ELIGIBILITY,
  },
  userInfos_dischargeDate: {
    displayName: "Discharge date",
    column: schema.UserInfos.dischargeDate,
    icon: ICON_ENUM.DATE,
    section: AUDIT_SECTIONS_ENUM.ELIGIBILITY,
    type: CHANGE_TYPE_ENUM.FIELD_CHANGE,
  },
  userInfos_insurance: {
    displayName: "Insurance",
    column: schema.UserInfos.insurance,
    icon: ICON_ENUM.PROFILE,
    section: AUDIT_SECTIONS_ENUM.ELIGIBILITY,
    type: CHANGE_TYPE_ENUM.FIELD_CHANGE,
  },
  userInfos_groupNumber: {
    displayName: "Group Number",
    column: schema.UserInfos.groupNumber,
    icon: ICON_ENUM.PROFILE,
    section: AUDIT_SECTIONS_ENUM.ELIGIBILITY,
    type: CHANGE_TYPE_ENUM.FIELD_CHANGE,
  },
  userInfos_eligibilityNotes: {
    displayName: "Eligibility notes",
    column: schema.UserInfos.eligibilityNotes,
    icon: ICON_ENUM.NOTES,
    section: AUDIT_SECTIONS_ENUM.ELIGIBILITY,
    type: CHANGE_TYPE_ENUM.FIELD_CHANGE,
  },
  userInfos_trackVisibility: {
    displayName: "Track Visibility",
    column: schema.UserInfos.trackVisibility,
    icon: ICON_ENUM.PROFILE,
    section: AUDIT_SECTIONS_ENUM.CHANGES_TO_PROFILE,
    type: CHANGE_TYPE_ENUM.FIELD_CHANGE,
  },
  users_followVisibility: {
    displayName: "Follow Visibility",
    column: schema.users.followVisibility,
    icon: ICON_ENUM.PROFILE,
    section: AUDIT_SECTIONS_ENUM.CHANGES_TO_PROFILE,
    type: CHANGE_TYPE_ENUM.FIELD_CHANGE,
  },
  users_groupsVisibility: {
    displayName: "Groups Visibility",
    column: schema.users.groupsVisibility,
    icon: ICON_ENUM.PROFILE,
    section: AUDIT_SECTIONS_ENUM.CHANGES_TO_PROFILE,
    type: CHANGE_TYPE_ENUM.FIELD_CHANGE,
  },
  userInfos_bio: {
    displayName: "App Profile Bio",
    column: schema.UserInfos.profileBio,
    icon: ICON_ENUM.PROFILE,
    section: AUDIT_SECTIONS_ENUM.CHANGES_TO_PROFILE,
    type: CHANGE_TYPE_ENUM.FIELD_CHANGE,
  },
  userInfos_updatedDate: {
    displayName: "App Profile Bio Updated Date",
    column: schema.UserInfos.profileBio,
    icon: ICON_ENUM.PROFILE,
    section: AUDIT_SECTIONS_ENUM.CHANGES_TO_PROFILE,
    type: CHANGE_TYPE_ENUM.FIELD_CHANGE,
  },
  userInfos_autoEligibilityNotes: {
    displayName: "Auto Eligibility Notes",
    column: schema.UserInfos.autoEligibilityNotes,
    icon: ICON_ENUM.NOTES,
    section: AUDIT_SECTIONS_ENUM.ELIGIBILITY,
    type: CHANGE_TYPE_ENUM.FIELD_CHANGE,
  },
  userInfos_aperoPatientId: {
    displayName: "Apero Patient ID",
    column: schema.UserInfos.aperoPatientId,
    icon: ICON_ENUM.PROFILE,
    section: AUDIT_SECTIONS_ENUM.ELIGIBILITY,
    type: CHANGE_TYPE_ENUM.FIELD_CHANGE,
  },
  userInfos_aperoLookupCode: {
    displayName: "Apero Lookup Code",
    column: schema.UserInfos.aperoLookupCode,
    icon: ICON_ENUM.PROFILE,
    section: AUDIT_SECTIONS_ENUM.ELIGIBILITY,
    type: CHANGE_TYPE_ENUM.FIELD_CHANGE,
  },
  // --------------------------------- WELLNESS PLAN FIELDS --------------------------------
  goals_name: {
    displayName: "Name",
    column: schema.goals.name,
    icon: ICON_ENUM.GOAL,
    section: AUDIT_SECTIONS_ENUM.WELLNESS_PLAN,
    type: CHANGE_TYPE_ENUM.GOAL_CHANGE,
  },
  goals_trackProgress: {
    displayName: "Track Progress",
    column: schema.goals.trackProgress,
    icon: ICON_ENUM.GOAL,
    section: AUDIT_SECTIONS_ENUM.WELLNESS_PLAN,
    type: CHANGE_TYPE_ENUM.GOAL_CHANGE,
  },
  goals_confidenceLevel: {
    displayName: "Confidence Level",
    column: schema.goals.confidenceLevel,
    icon: ICON_ENUM.GOAL,
    section: AUDIT_SECTIONS_ENUM.WELLNESS_PLAN,
    type: CHANGE_TYPE_ENUM.GOAL_CHANGE,
  },
  goals_category: {
    displayName: "Category",
    column: schema.goals.category,
    icon: ICON_ENUM.GOAL,
    section: AUDIT_SECTIONS_ENUM.WELLNESS_PLAN,
    type: CHANGE_TYPE_ENUM.GOAL_CHANGE,
  },
  goals_targetDate: {
    displayName: "Target Date",
    column: schema.goals.targetDate,
    icon: ICON_ENUM.GOAL,
    section: AUDIT_SECTIONS_ENUM.WELLNESS_PLAN,
    type: CHANGE_TYPE_ENUM.GOAL_CHANGE,
  },
  milestones_name: {
    displayName: "Name",
    column: schema.milestones.name,
    icon: ICON_ENUM.BADGE,
    section: AUDIT_SECTIONS_ENUM.WELLNESS_PLAN,
    type: CHANGE_TYPE_ENUM.MILESTONE_CHANGE || CHANGE_TYPE_ENUM.MILESTONE_ADDED,
  },
  milestones_description: {
    displayName: "Description",
    column: schema.milestones.description,
    icon: ICON_ENUM.BADGE,
    section: AUDIT_SECTIONS_ENUM.WELLNESS_PLAN,
    type: CHANGE_TYPE_ENUM.MILESTONE_CHANGE || CHANGE_TYPE_ENUM.MILESTONE_ADDED,
  },
  milestones_status: {
    displayName: "Status",
    column: schema.milestones.status,
    icon: ICON_ENUM.BADGE,
    section: AUDIT_SECTIONS_ENUM.WELLNESS_PLAN,
    type: CHANGE_TYPE_ENUM.MILESTONE_CHANGE || CHANGE_TYPE_ENUM.MILESTONE_ADDED,
  },
  StrengthsAndObstacles_value: {
    displayName: "Strengths and Obstacles",
    column: schema.StrengthsAndObstacles.value,
    icon: ICON_ENUM.GOAL,
    section: AUDIT_SECTIONS_ENUM.WELLNESS_PLAN,
    type:
      CHANGE_TYPE_ENUM.STRENGTH_AND_OBSTACLE_CHANGE || CHANGE_TYPE_ENUM.STRENGTH_AND_OBSTACLE_ADDED,
  },

  // --------------------------------- REWARDS FIELDS --------------------------------
  userCompletedRewards_amount: {
    displayName: "Amount",
    column: schema.userCompletedRewards.amount,
    icon: ICON_ENUM.PROFILE,
    section: AUDIT_SECTIONS_ENUM.TODO,
    type: CHANGE_TYPE_ENUM.REWARD_COMPLETED,
  },
  transaction_type: {
    displayName: "Type",
    column: schema.transaction.type,
    icon: ICON_ENUM.PROFILE,
    section: AUDIT_SECTIONS_ENUM.TODO,
    type: CHANGE_TYPE_ENUM.REWARD_REDEEMED,
  },
  transaction_amount: {
    displayName: "Amount",
    column: schema.transaction.amount,
    icon: ICON_ENUM.PROFILE,
    section: AUDIT_SECTIONS_ENUM.TODO,
    type: CHANGE_TYPE_ENUM.REWARD_REDEEMED,
  },
  transaction_balance: {
    displayName: "Balance",
    column: schema.transaction.balance,
    icon: ICON_ENUM.PROFILE,
    section: AUDIT_SECTIONS_ENUM.TODO,
    type: CHANGE_TYPE_ENUM.REWARD_REDEEMED,
  },
  rewardsSchedule_title: {
    displayName: "Title",
    column: schema.rewardsSchedule.title,
    icon: ICON_ENUM.PROFILE,
    section: AUDIT_SECTIONS_ENUM.TODO,
    type: CHANGE_TYPE_ENUM.CUSTOM_REWARD_CREATED,
  },
  rewardsSchedule_amountForEnrolled: {
    displayName: "Value",
    column: schema.rewardsSchedule.amountForEnrolled,
    icon: ICON_ENUM.PROFILE,
    section: AUDIT_SECTIONS_ENUM.TODO,
    type: CHANGE_TYPE_ENUM.CUSTOM_REWARD_CREATED,
  },
  userRewards_customAmount: {
    displayName: "Value",
    column: schema.userRewards.customAmount,
    icon: ICON_ENUM.PROFILE,
    section: AUDIT_SECTIONS_ENUM.TODO,
    type: CHANGE_TYPE_ENUM.REWARD_CHANGE,
  },
  userRewards_availableAfter: {
    displayName: "Start date",
    column: schema.userRewards.availableAfter,
    icon: ICON_ENUM.PROFILE,
    section: AUDIT_SECTIONS_ENUM.TODO,
    type: CHANGE_TYPE_ENUM.REWARD_CHANGE,
  },

  // --------------------------------- SMS AND CALLS FIELDS --------------------------------
  call_receiverPhoneNumber: {
    displayName: "Receiver Phone Number",
    column: null,
    icon: ICON_ENUM.CALL,
    section: AUDIT_SECTIONS_ENUM.SMS_AND_CALLS,
    type: CHANGE_TYPE_ENUM.SMS_AND_CALLS,
  },
  call_senderPhoneNumber: {
    displayName: "Sender Phone Number",
    column: null,
    icon: ICON_ENUM.CALL,
    section: AUDIT_SECTIONS_ENUM.SMS_AND_CALLS,
    type: CHANGE_TYPE_ENUM.SMS_AND_CALLS,
  },
  call_duration: {
    displayName: "Duration",
    column: null,
    icon: ICON_ENUM.CALL,
    section: AUDIT_SECTIONS_ENUM.SMS_AND_CALLS,
    type: CHANGE_TYPE_ENUM.SMS_AND_CALLS,
  },
  call_disposition: {
    displayName: "Disposition",
    column: null,
    icon: ICON_ENUM.CALL,
    section: AUDIT_SECTIONS_ENUM.SMS_AND_CALLS,
    type: CHANGE_TYPE_ENUM.SMS_AND_CALLS,
  },
  call_name: {
    displayName: "Name",
    column: null,
    icon: ICON_ENUM.CALL,
    section: AUDIT_SECTIONS_ENUM.SMS_AND_CALLS,
    type: CHANGE_TYPE_ENUM.SMS_AND_CALLS,
  },
  call_other: {
    displayName: "Other",
    column: null,
    icon: ICON_ENUM.CALL,
    section: AUDIT_SECTIONS_ENUM.SMS_AND_CALLS,
    type: CHANGE_TYPE_ENUM.SMS_AND_CALLS,
  },
  call_phoneSource: {
    displayName: "Phone Source",
    column: null,
    icon: ICON_ENUM.CALL,
    section: AUDIT_SECTIONS_ENUM.SMS_AND_CALLS,
    type: CHANGE_TYPE_ENUM.SMS_AND_CALLS,
  },
  call_timestamp: {
    displayName: "Call Timestamp",
    column: null,
    icon: ICON_ENUM.CALL,
    section: AUDIT_SECTIONS_ENUM.SMS_AND_CALLS,
    type: CHANGE_TYPE_ENUM.SMS_AND_CALLS,
  },
  sms_receiverPhoneNumber: {
    displayName: "Receiver Phone Number",
    column: null,
    icon: ICON_ENUM.SMS,
    section: AUDIT_SECTIONS_ENUM.SMS_AND_CALLS,
    type: CHANGE_TYPE_ENUM.SMS_AND_CALLS,
  },
  sms_senderPhoneNumber: {
    displayName: "Sender Phone Number",
    column: null,
    icon: ICON_ENUM.SMS,
    section: AUDIT_SECTIONS_ENUM.SMS_AND_CALLS,
    type: CHANGE_TYPE_ENUM.SMS_AND_CALLS,
  },
  sms_messageText: {
    displayName: "Message Text",
    column: null,
    icon: ICON_ENUM.SMS,
    section: AUDIT_SECTIONS_ENUM.SMS_AND_CALLS,
    type: CHANGE_TYPE_ENUM.SMS_AND_CALLS,
  },
  sms_disposition: {
    displayName: "Disposition",
    column: null,
    icon: ICON_ENUM.SMS,
    section: AUDIT_SECTIONS_ENUM.SMS_AND_CALLS,
    type: CHANGE_TYPE_ENUM.SMS_AND_CALLS,
  },
  sms_name: {
    displayName: "Name",
    column: null,
    icon: ICON_ENUM.SMS,
    section: AUDIT_SECTIONS_ENUM.SMS_AND_CALLS,
    type: CHANGE_TYPE_ENUM.SMS_AND_CALLS,
  },
  sms_other: {
    displayName: "Other",
    column: null,
    icon: ICON_ENUM.SMS,
    section: AUDIT_SECTIONS_ENUM.SMS_AND_CALLS,
    type: CHANGE_TYPE_ENUM.SMS_AND_CALLS,
  },
  sms_phoneSource: {
    displayName: "Phone Source",
    column: null,
    icon: ICON_ENUM.SMS,
    section: AUDIT_SECTIONS_ENUM.SMS_AND_CALLS,
    type: CHANGE_TYPE_ENUM.SMS_AND_CALLS,
  },
  sms_conversations: {
    displayName: "Conversation",
    column: null,
    icon: ICON_ENUM.SMS,
    section: AUDIT_SECTIONS_ENUM.SMS_AND_CALLS,
    type: CHANGE_TYPE_ENUM.SMS_AND_CALLS,
  },
  // --------------------------------- MIX PANEL EVENTS --------------------------------
  mixPanelEvents_events: {
    displayName: "Mix Panel Events",
    column: null,
    icon: ICON_ENUM.BADGE,
    section: AUDIT_SECTIONS_ENUM.MIX_PANEL_EVENTS,
    type: CHANGE_TYPE_ENUM.MIX_PANEL_EVENT,
  },

  // --------------------------------- MEMBER SURVEYS FIELDS --------------------------------
};
