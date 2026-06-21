"use client";

import Sidebar from "@/components/layout/Sidebar";
import Topbar from "@/components/layout/Topbar";

interface AppShellProps {
  children: React.ReactNode;
  breadcrumbs?: { label: string; href?: string }[];
  title?: string;
  topbarActions?: React.ReactNode;
  datasetProgress?: { annotated: number; remaining: number; total: number };
}

export default function AppShell({
  children,
  breadcrumbs,
  title,
  topbarActions,
  datasetProgress,
}: AppShellProps) {
  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden" }}>
      <Sidebar datasetProgress={datasetProgress} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <Topbar breadcrumbs={breadcrumbs} title={title} actions={topbarActions} />
        <main
          style={{
            flex: 1,
            overflow: "auto",
            background: "var(--color-bg-primary)",
          }}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
