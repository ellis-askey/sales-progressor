"use client";

import { TeamListView, type TeamMember } from "@/components/agent/TeamListView";

const TOM: TeamMember = {
  id: "1",
  name: "Tom Hartwell",
  email: "tom@hartwellestates.co.uk",
  role: "director",
  canViewAllFiles: true,
};

const OLIVIA: TeamMember = {
  id: "2",
  name: "Olivia Chen",
  email: "olivia@hartwellestates.co.uk",
  role: "negotiator",
  canViewAllFiles: false,
};

export function TeamListHelpExample(_props: Record<string, string>) {
  return (
    <TeamListView
      directors={[TOM]}
      negotiators={[OLIVIA]}
      currentUserId={TOM.id}
      onToggleViewAll={() => {}}
      onRemove={() => {}}
      onAddClick={() => {}}
    />
  );
}
