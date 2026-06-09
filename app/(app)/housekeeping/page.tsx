"use client";

import { PageHeader, Card, StubBanner, Icon } from "@/web/components/ui";

const COLUMNS = [
  { title: "Dirty", tone: "warning", icon: "warning" },
  { title: "In Progress", tone: "info", icon: "cleaning_services" },
  { title: "Inspected", tone: "info", icon: "verified" },
  { title: "Ready", tone: "success", icon: "check_circle" },
] as const;

export default function HousekeepingPage() {
  return (
    <div>
      <PageHeader title="Housekeeping Board" subtitle="Room turnover and cleaning workflow." />
      <div className="mb-6">
        <StubBanner feature="Housekeeping" phase="the Housekeeping module (HousekeepingTask + Room status exist in the schema; endpoints are not yet built)" />
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {COLUMNS.map((c) => (
          <Card key={c.title} className="opacity-60">
            <div className="mb-3 flex items-center gap-2">
              <Icon name={c.icon} className="text-[20px] text-on-surface-variant" />
              <h2 className="text-sm font-semibold text-on-surface">{c.title}</h2>
            </div>
            <div className="grid place-items-center rounded-lg border border-dashed border-outline-variant py-10 text-xs text-on-surface-variant">
              Awaiting housekeeping API
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
