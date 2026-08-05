import { DraftingTemplate } from '../types';
import { implementationPlanTemplate } from './implementation-plan.template';
import { salaryIncreaseDecisionTemplate } from './salary-increase-decision.template';
import { offerLetterTemplate } from './offer-letter.template';
import { probationContractTemplate } from './probation-contract.template';
import { internalAnnouncementTemplate } from './internal-announcement.template';
import { officialDispatchTemplate } from './official-dispatch.template';
import { submissionProposalTemplate } from './submission-proposal.template';
import { workReportTemplate } from './work-report.template';
import { meetingMinutesTemplate } from './meeting-minutes.template';
import { powerOfAttorneyTemplate } from './power-of-attorney.template';
import { digitalProposalTemplate } from './digital-proposal.template';

export {
  implementationPlanTemplate,
  salaryIncreaseDecisionTemplate,
  offerLetterTemplate,
  probationContractTemplate,
  internalAnnouncementTemplate,
  officialDispatchTemplate,
  submissionProposalTemplate,
  workReportTemplate,
  meetingMinutesTemplate,
  powerOfAttorneyTemplate,
  digitalProposalTemplate
};

export const BUILTIN_TEMPLATES: DraftingTemplate[] = [
  implementationPlanTemplate,
  salaryIncreaseDecisionTemplate,
  offerLetterTemplate,
  probationContractTemplate,
  internalAnnouncementTemplate,
  officialDispatchTemplate,
  submissionProposalTemplate,
  workReportTemplate,
  meetingMinutesTemplate,
  powerOfAttorneyTemplate,
  digitalProposalTemplate
];
