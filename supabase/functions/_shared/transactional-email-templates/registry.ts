/// <reference types="npm:@types/react@18.3.1" />
import * as React from "npm:react@18.3.1";

export interface TemplateEntry {
  component: React.ComponentType<any>;
  subject: string | ((data: Record<string, any>) => string);
  to?: string;
  displayName?: string;
  previewData?: Record<string, any>;
}

import { template as accountApproved } from "./account-approved.tsx";
import { template as accountRejected } from "./account-rejected.tsx";

export const TEMPLATES: Record<string, TemplateEntry> = {
  "account-approved": accountApproved,
  "account-rejected": accountRejected,
};
