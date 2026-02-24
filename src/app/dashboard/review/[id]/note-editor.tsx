"use client";

import { useState, useTransition } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  NoteEditIcon,
  CheckmarkCircle01Icon,
} from "@hugeicons/core-free-icons";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { updateNote, approveNote } from "../actions";

interface NoteEditorProps {
  noteId: string;
  isDraft: boolean;
  subjectiveText: string | null;
  objectiveText: string | null;
  assessmentText: string | null;
  planText: string | null;
  createdAt: string;
}

export function NoteEditor({
  noteId,
  isDraft,
  subjectiveText,
  objectiveText,
  assessmentText,
  planText,
  createdAt,
}: NoteEditorProps) {
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<"saved" | "approved" | null>(null);

  const [subjective, setSubjective] = useState(subjectiveText ?? "");
  const [objective, setObjective] = useState(objectiveText ?? "");
  const [assessment, setAssessment] = useState(assessmentText ?? "");
  const [plan, setPlan] = useState(planText ?? "");

  const soapFields = {
    subjectiveText: subjective || null,
    objectiveText: objective || null,
    assessmentText: assessment || null,
    planText: plan || null,
  };

  const handleSave = () => {
    setFeedback(null);
    startTransition(async () => {
      const result = await updateNote(noteId, soapFields);
      if (result.success) {
        setFeedback("saved");
        setTimeout(() => setFeedback(null), 2500);
      }
    });
  };

  const handleApprove = () => {
    setFeedback(null);
    startTransition(async () => {
      const result = await approveNote(noteId, soapFields);
      if (result.success) {
        setFeedback("approved");
      }
    });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <HugeiconsIcon
            icon={NoteEditIcon}
            size={18}
            className="text-muted-foreground"
          />
          <CardTitle>Clinical Note</CardTitle>
        </div>
        <CardDescription>
          Generated {createdAt} · {isDraft ? "Draft" : "Approved"}
        </CardDescription>
      </CardHeader>
      <CardContent className="pb-6">
        {isDraft ? (
          <div className="space-y-6">
            <SoapFieldEditable
              label="Subjective"
              value={subjective}
              onChange={setSubjective}
              placeholder="Patient's reported symptoms, feelings, and concerns..."
            />
            <SoapFieldEditable
              label="Objective"
              value={objective}
              onChange={setObjective}
              placeholder="Observable findings, vitals, and measurable data..."
            />
            <SoapFieldEditable
              label="Assessment"
              value={assessment}
              onChange={setAssessment}
              placeholder="Clinical interpretation and diagnosis..."
            />
            <SoapFieldEditable
              label="Plan"
              value={plan}
              onChange={setPlan}
              placeholder="Treatment plan, follow-ups, and next steps..."
            />
          </div>
        ) : (
          <div className="space-y-4">
            <SoapFieldReadOnly label="Subjective" value={subjective} />
            <Separator />
            <SoapFieldReadOnly label="Objective" value={objective} />
            <Separator />
            <SoapFieldReadOnly label="Assessment" value={assessment} />
            <Separator />
            <SoapFieldReadOnly label="Plan" value={plan} />
          </div>
        )}
      </CardContent>
      <CardFooter className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex-1">
          {feedback === "saved" && (
            <span className="text-xs text-primary flex items-center gap-1.5">
              <HugeiconsIcon icon={CheckmarkCircle01Icon} size={14} />
              Changes saved
            </span>
          )}
          {feedback === "approved" && (
            <span className="text-xs text-primary flex items-center gap-1.5">
              <HugeiconsIcon icon={CheckmarkCircle01Icon} size={14} />
              Note approved successfully
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="rounded-full"
            disabled={!isDraft || isPending}
            onClick={handleSave}
          >
            {isPending && feedback !== "approved" ? "Saving…" : "Save Changes"}
          </Button>
          <Button
            size="sm"
            className="rounded-full shadow-sm shadow-primary/25"
            disabled={!isDraft || isPending}
            onClick={handleApprove}
          >
            {isPending && feedback !== "saved" ? "Approving…" : "Approve Note"}
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}

function SoapFieldEditable({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (val: string) => void;
  placeholder: string;
}) {
  return (
    <div className="space-y-2">
      <label className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground/80">
        {label}
      </label>
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="min-h-24 rounded-xl bg-muted/20 px-4 py-3 text-sm leading-6 shadow-sm focus-visible:ring-2 focus-visible:ring-primary/20"
      />
    </div>
  );
}

function SoapFieldReadOnly({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="space-y-1">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </h3>
      <p className="text-sm leading-relaxed">
        {value || (
          <span className="text-muted-foreground italic">Not provided</span>
        )}
      </p>
    </div>
  );
}
