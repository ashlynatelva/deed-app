"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { I } from "@/components/ui/Icon";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";

export type AgentContact = {
  name: string;
  title: string;
  email: string;
  phone: string;
};

/**
 * The client portal's "Your advisor" card. The agent profile is supplied
 * by the parent (Client Overview server component) so this stays a pure
 * presentational shell — no Supabase lookups here.
 */
export const AgentContactCard = ({ agent }: { agent: AgentContact }) => {
  const router = useRouter();
  const toast = useToast();
  const [callOpen, setCallOpen] = React.useState(false);

  return (
    <Card>
      <div className="text-[11px] uppercase tracking-[.12em] text-muted mb-3">Your advisor</div>
      <div className="flex gap-3.5 items-center mb-4">
        <Avatar name={agent.name} size={48} />
        <div>
          <div className="text-[15px] font-semibold">{agent.name}</div>
          <div className="text-[12px] text-muted">{agent.title}</div>
        </div>
      </div>
      <div className="flex flex-col gap-2 text-[13px]">
        <a className="flex gap-2.5 items-center text-charcoal hover:text-ink" href={`mailto:${agent.email}`}>
          <I.Mail size={14} className="text-muted" />
          {agent.email}
        </a>
        <a className="flex gap-2.5 items-center text-charcoal num hover:text-ink" href={`tel:${agent.phone.replace(/[^0-9+]/g, "")}`}>
          <I.Phone size={14} className="text-muted" />
          {agent.phone}
        </a>
      </div>
      <div className="mt-4 pt-4 border-t border-hairline-2 flex gap-2">
        <Button
          kind="secondary"
          size="sm"
          icon={<I.Mail size={12} />}
          className="flex-1"
          onClick={() => router.push("/client/messages")}
        >
          Message
        </Button>
        <Button
          kind="dark"
          size="sm"
          icon={<I.Phone size={12} />}
          className="flex-1"
          onClick={() => setCallOpen(true)}
        >
          Call
        </Button>
      </div>

      <Modal
        open={callOpen}
        onClose={() => setCallOpen(false)}
        title={`Call ${agent.name}`}
        size="md"
        footer={
          <>
            <Button kind="secondary" onClick={() => setCallOpen(false)}>Close</Button>
            <Button
              kind="primary"
              onClick={() => {
                toast.push(`Calling ${agent.name}…`, "info");
                setCallOpen(false);
              }}
            >
              Call now
            </Button>
          </>
        }
      >
        <div className="text-[13.5px] text-charcoal leading-[1.6]">
          <div className="flex items-center gap-3 mb-3">
            <I.Phone size={16} className="text-muted" />
            <span className="num text-[15px] font-medium">{agent.phone}</span>
          </div>
          <p className="text-muted">
            {agent.name.split(" ")[0]} is typically available 9am–6pm ET on business days.
            For anything urgent, leave a voicemail and you&apos;ll get a callback within a few hours.
          </p>
        </div>
      </Modal>
    </Card>
  );
};
