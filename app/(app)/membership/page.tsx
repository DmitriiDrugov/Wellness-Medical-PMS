"use client";

import { PageHeader, Card, StubBanner, Icon } from "@/web/components/ui";

export default function MembershipPage() {
  return (
    <div>
      <PageHeader title="Membership Plans" subtitle="Subscription tiers, pricing, and guest benefits." />
      <div className="mb-6">
        <StubBanner feature="Memberships" phase="Phase 8 (MembershipPlan, Membership, BillingGateway)" />
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {["Essential", "Premium", "Diamond"].map((tier) => (
          <Card key={tier} className="opacity-60">
            <Icon name="card_membership" className="text-[24px] text-primary" />
            <h2 className="mt-2 text-lg font-semibold text-on-surface">{tier} Tier</h2>
            <p className="text-sm text-on-surface-variant">Plan management activates with Phase 8.</p>
          </Card>
        ))}
      </div>
    </div>
  );
}
