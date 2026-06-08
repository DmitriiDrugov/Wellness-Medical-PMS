import type { ComplianceEventType } from "@prisma/client";

/**
 * Abstraction over the Hungarian compliance integrations (NTAK daily reporting and
 * NAV online invoicing). The MVP ships a logging implementation that records the
 * payload it WOULD send; a real HTTP-backed implementation can be swapped in later
 * without changing any caller (see spec §1, ADR 0001).
 */
export interface ComplianceGateway {
  send(type: ComplianceEventType, payload: unknown): Promise<{ reference: string; sentAt: Date }>;
}

export class LoggingComplianceGateway implements ComplianceGateway {
  async send(type: ComplianceEventType, payload: unknown): Promise<{ reference: string; sentAt: Date }> {
    const reference = `LOG-${type}-${Date.now()}`;
    // In the MVP we only log; nothing is transmitted to NTAK/NAV.
    console.info(`[ComplianceGateway] Would send ${type}`, JSON.stringify(payload));
    return { reference, sentAt: new Date() };
  }
}

/** Default gateway used by the compliance service. */
export const complianceGateway: ComplianceGateway = new LoggingComplianceGateway();
