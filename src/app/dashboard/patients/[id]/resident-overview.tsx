"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updatePatientField } from "./actions";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { HugeiconsIcon } from "@hugeicons/react";
import { NoteEditIcon } from "@hugeicons/core-free-icons";

type PatientOverview = {
  id: string;
  dateOfBirth: Date | string | null;
  sex: string | null;
  codeStatus: string | null;
  admitDate: Date | string | null;
  roomLabel: string | null;
  bedLabel: string | null;
  primaryPayor: string | null;
};

type FieldKey =
  | "dateOfBirth"
  | "sex"
  | "codeStatus"
  | "admitDate"
  | "roomLabel"
  | "bedLabel"
  | "primaryPayor";

type FieldConfig = {
  key: FieldKey;
  label: string;
  type: "text" | "date";
  placeholder?: string;
  section: "Demographics" | "Stay";
};

const FIELD_CONFIG: FieldConfig[] = [
  {
    key: "dateOfBirth",
    label: "DOB",
    type: "date",
    section: "Demographics",
  },
  {
    key: "sex",
    label: "Sex",
    type: "text",
    placeholder: "e.g. Female",
    section: "Demographics",
  },
  {
    key: "codeStatus",
    label: "Code status",
    type: "text",
    placeholder: "e.g. DNR",
    section: "Demographics",
  },
  {
    key: "admitDate",
    label: "Admit date",
    type: "date",
    section: "Stay",
  },
  {
    key: "roomLabel",
    label: "Room",
    type: "text",
    placeholder: "e.g. 204",
    section: "Stay",
  },
  {
    key: "bedLabel",
    label: "Bed",
    type: "text",
    placeholder: "e.g. B",
    section: "Stay",
  },
  {
    key: "primaryPayor",
    label: "Primary payor",
    type: "text",
    placeholder: "e.g. Medicare",
    section: "Stay",
  },
];

function formatShortDate(value?: Date | string | null): string {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatDateInput(value?: Date | string | null): string {
  if (!value) return "";
  if (typeof value === "string") return value;
  return value.toISOString().slice(0, 10);
}

function formatValue(value?: string | null): string {
  return value && value.length > 0 ? value : "—";
}

function getDisplayValue(field: FieldConfig, patient: PatientOverview): string {
  const raw = patient[field.key];
  if (field.type === "date") {
    return formatShortDate(raw);
  }
  return formatValue(raw as string | null | undefined);
}

function getInputValue(field: FieldConfig, patient: PatientOverview): string {
  const raw = patient[field.key];
  if (field.type === "date") {
    return formatDateInput(raw);
  }
  return typeof raw === "string" ? raw : "";
}

export function ResidentOverview({ patient }: { patient: PatientOverview }) {
  const [editingField, setEditingField] = useState<FieldKey | null>(null);
  const [draftValue, setDraftValue] = useState("");
  const [editMode, setEditMode] = useState(true);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function beginEdit(field: FieldConfig) {
    setEditingField(field.key);
    setDraftValue(getInputValue(field, patient));
  }

  function cancelEdit() {
    setEditingField(null);
    setDraftValue("");
  }

  function saveEdit(field: FieldConfig) {
    const value = draftValue.trim();
    startTransition(async () => {
      await updatePatientField(patient.id, field.key, value.length ? value : null);
      setEditingField(null);
      setDraftValue("");
      router.refresh();
    });
  }

  const demographics = FIELD_CONFIG.filter((f) => f.section === "Demographics");
  const stay = FIELD_CONFIG.filter((f) => f.section === "Stay");
  const toggleEditMode = () => {
    setEditMode((prev) => {
      const next = !prev;
      if (!next) {
        setEditingField(null);
        setDraftValue("");
      }
      return next;
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Resident Overview</CardTitle>
        <CardDescription>
          Key demographics, stay details, and billing context.
        </CardDescription>
        <CardAction>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="rounded-full"
            onClick={toggleEditMode}
          >
            <HugeiconsIcon icon={NoteEditIcon} data-icon="inline-start" />
            {editMode ? "Hide edits" : "Edit"}
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="grid gap-6 md:grid-cols-2">
        <OverviewSection
          title="Demographics"
          fields={demographics}
          patient={patient}
          editMode={editMode}
          editingField={editingField}
          draftValue={draftValue}
          isPending={isPending}
          onEdit={beginEdit}
          onChange={setDraftValue}
          onCancel={cancelEdit}
          onSave={saveEdit}
        />
        <OverviewSection
          title="Stay"
          fields={stay}
          patient={patient}
          editMode={editMode}
          editingField={editingField}
          draftValue={draftValue}
          isPending={isPending}
          onEdit={beginEdit}
          onChange={setDraftValue}
          onCancel={cancelEdit}
          onSave={saveEdit}
        />
      </CardContent>
    </Card>
  );
}

function OverviewSection({
  title,
  fields,
  patient,
  editMode,
  editingField,
  draftValue,
  isPending,
  onEdit,
  onChange,
  onCancel,
  onSave,
}: {
  title: string;
  fields: FieldConfig[];
  patient: PatientOverview;
  editMode: boolean;
  editingField: FieldKey | null;
  draftValue: string;
  isPending: boolean;
  onEdit: (field: FieldConfig) => void;
  onChange: (value: string) => void;
  onCancel: () => void;
  onSave: (field: FieldConfig) => void;
}) {
  return (
    <div className="grid gap-3 text-sm">
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {title}
      </p>
      <div className="grid gap-2">
        {fields.map((field) => {
          const isEditing = editingField === field.key;
          return (
            <div
              key={field.key}
              className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border/40 px-3 py-2"
            >
              <div className="min-w-[120px] text-muted-foreground">
                {field.label}
              </div>
              <div className="flex flex-1 items-center justify-between gap-3">
                {isEditing ? (
                  <Input
                    type={field.type}
                    placeholder={field.placeholder}
                    value={draftValue}
                    onChange={(event) => onChange(event.target.value)}
                    className="max-w-xs"
                  />
                ) : (
                  <div className="font-medium text-right">
                    {getDisplayValue(field, patient)}
                  </div>
                )}
                <div className="flex items-center gap-2">
                  {isEditing ? (
                    <>
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        disabled={isPending}
                        onClick={() => onSave(field)}
                      >
                        Save
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        disabled={isPending}
                        onClick={onCancel}
                      >
                        Cancel
                      </Button>
                    </>
                  ) : (
                    editMode && (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="rounded-full"
                        onClick={() => onEdit(field)}
                      >
                        Edit
                      </Button>
                    )
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
