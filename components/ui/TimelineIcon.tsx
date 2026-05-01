"use client";
// Unified icon system for the activity timeline.
// All gradient/colour decisions live here — not scattered across call sites.

import {
  MailCheck, Mail, MailOpen,
  Phone, PhoneIncoming,
  MessageSquare, MessageSquareText,
  Voicemail,
  MessageCircle,
  Mailbox,
  StickyNote,
  Check, MinusCircle,
  Circle,
} from "lucide-react";
import type { ComponentType, CSSProperties } from "react";

export type TimelineEntryType =
  | "system_email"
  | "outbound_email"
  | "inbound_email"
  | "outbound_phone"
  | "inbound_phone"
  | "outbound_sms"
  | "inbound_sms"
  | "voicemail"
  | "whatsapp"
  | "post_letter"
  | "internal_note"
  | "milestone_confirmed"
  | "milestone_not_required";

type IconConfig = {
  Icon: ComponentType<{ className?: string; style?: CSSProperties }>;
  bgGradient: string;
  iconColor: string;
};

const ICON_MAP: Record<TimelineEntryType, IconConfig> = {
  system_email: {
    Icon: MailCheck,
    bgGradient: "linear-gradient(135deg, #EEEDFE 0%, #CECBF6 100%)",
    iconColor: "#3C3489",
  },
  outbound_email: {
    Icon: Mail,
    bgGradient: "linear-gradient(135deg, #EEEDFE 0%, #CECBF6 100%)",
    iconColor: "#3C3489",
  },
  inbound_email: {
    Icon: MailOpen,
    bgGradient: "linear-gradient(135deg, #EEEDFE 0%, #CECBF6 100%)",
    iconColor: "#3C3489",
  },
  outbound_phone: {
    Icon: Phone,
    bgGradient: "linear-gradient(135deg, #FCEBEB 0%, #F7C1C1 100%)",
    iconColor: "#791F1F",
  },
  inbound_phone: {
    Icon: PhoneIncoming,
    bgGradient: "linear-gradient(135deg, #FCEBEB 0%, #F7C1C1 100%)",
    iconColor: "#791F1F",
  },
  outbound_sms: {
    Icon: MessageSquare,
    bgGradient: "linear-gradient(135deg, #EAF3DE 0%, #C0DD97 100%)",
    iconColor: "#27500A",
  },
  inbound_sms: {
    Icon: MessageSquareText,
    bgGradient: "linear-gradient(135deg, #EAF3DE 0%, #C0DD97 100%)",
    iconColor: "#27500A",
  },
  voicemail: {
    Icon: Voicemail,
    bgGradient: "linear-gradient(135deg, #E1F5EE 0%, #9FE1CB 100%)",
    iconColor: "#085041",
  },
  whatsapp: {
    Icon: MessageCircle,
    bgGradient: "linear-gradient(135deg, #EAF3DE 0%, #C0DD97 100%)",
    iconColor: "#27500A",
  },
  post_letter: {
    Icon: Mailbox,
    bgGradient: "linear-gradient(135deg, #FAEEDA 0%, #FAC775 100%)",
    iconColor: "#633806",
  },
  internal_note: {
    Icon: StickyNote,
    bgGradient: "linear-gradient(135deg, #E6F1FB 0%, #B5D4F4 100%)",
    iconColor: "#0C447C",
  },
  milestone_confirmed: {
    Icon: Check,
    bgGradient: "linear-gradient(135deg, #EAF3DE 0%, #C0DD97 100%)",
    iconColor: "#27500A",
  },
  milestone_not_required: {
    Icon: MinusCircle,
    bgGradient: "linear-gradient(135deg, #F1EFE8 0%, #D3D1C7 100%)",
    iconColor: "#444441",
  },
};

const FALLBACK: IconConfig = {
  Icon: Circle,
  bgGradient: "linear-gradient(135deg, #F1EFE8 0%, #D3D1C7 100%)",
  iconColor: "#444441",
};

export function resolveEntryType(entry: {
  kind: "milestone" | "comm";
  isNotRequired?: boolean;
  isAutomated?: boolean;
  type?: string;
  method?: string | null;
}): TimelineEntryType {
  if (entry.kind === "milestone") {
    return entry.isNotRequired ? "milestone_not_required" : "milestone_confirmed";
  }
  if (entry.isAutomated) return "system_email";
  if (entry.type === "internal_note") return "internal_note";
  const method = entry.method ?? null;
  const dir = entry.type === "outbound" ? "outbound" : "inbound";
  if (method === "email")     return `${dir}_email`;
  if (method === "phone")     return `${dir}_phone`;
  if (method === "sms")       return `${dir}_sms`;
  if (method === "voicemail") return "voicemail";
  if (method === "whatsapp")  return "whatsapp";
  if (method === "post")      return "post_letter";
  return dir === "outbound" ? "outbound_email" : "inbound_email";
}

type Props = {
  type: TimelineEntryType | string;
  size?: number;
};

export function TimelineIcon({ type, size = 40 }: Props) {
  const config = ICON_MAP[type as TimelineEntryType] ?? FALLBACK;
  const { Icon, bgGradient, iconColor } = config;
  const iconSize = Math.round(size * 0.45);

  return (
    <div
      style={{
        width: size,
        height: size,
        background: bgGradient,
        borderRadius: "50%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      <Icon
        style={{ width: iconSize, height: iconSize, color: iconColor, flexShrink: 0 }}
      />
    </div>
  );
}
