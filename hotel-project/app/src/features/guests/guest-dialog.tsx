import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useSaveGuest, type Guest, type IdDocumentType } from "@/api/guests";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import {
  CheckboxField,
  FormError,
  InputField,
  SelectField,
  TextAreaField,
} from "@/components/ui/fields";
import { errorMessage } from "@/lib/errors";
import { useToast } from "@/components/ui/toast";

/** Create or edit a guest. A guest needs a phone or an email; ID number goes with its type. */
export function GuestDialog({
  guest,
  onClose,
  onCreated,
}: {
  guest?: Guest;
  onClose: () => void;
  /** When set, a newly created guest is handed back instead of opening their profile. */
  onCreated?: (guest: Guest) => void;
}) {
  const save = useSaveGuest();
  const toast = useToast();
  const navigate = useNavigate();
  const [fullName, setFullName] = useState(guest?.fullName ?? "");
  const [phone, setPhone] = useState(guest?.phone ?? "");
  const [email, setEmail] = useState(guest?.email ?? "");
  const [nationality, setNationality] = useState(guest?.nationality ?? "EG");
  const [docType, setDocType] = useState<IdDocumentType | "">(guest?.idDocumentType ?? "");
  const [docNumber, setDocNumber] = useState(guest?.idDocumentNumber ?? "");
  const [preferences, setPreferences] = useState(guest?.preferences ?? "");
  const [vip, setVip] = useState(guest?.vip ?? false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!phone.trim() && !email.trim()) {
      setError("Add a phone number or an email so the hotel can reach the guest.");
      return;
    }
    if (Boolean(docType) !== Boolean(docNumber.trim())) {
      setError("Choose the document type and enter its number together.");
      return;
    }
    try {
      const saved = await save.mutateAsync({
        id: guest?.id,
        input: {
          fullName: fullName.trim(),
          phone: phone.trim() || null,
          email: email.trim() || null,
          nationality: nationality.trim().toUpperCase() || null,
          idDocumentType: docType || null,
          idDocumentNumber: docNumber.trim() || null,
          preferences: preferences.trim() || null,
          vip,
        },
      });
      toast(guest ? "Guest updated" : `${saved.fullName} added`);
      onClose();
      if (!guest) {
        if (onCreated) onCreated(saved);
        else navigate(`/guests/${saved.id}`);
      }
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <Dialog
      open
      title={guest ? `Edit ${guest.fullName}` : "New guest"}
      onClose={onClose}
      width={560}
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" type="submit" form="guest-form" disabled={save.isPending}>
            {save.isPending ? "Saving…" : "Save guest"}
          </Button>
        </>
      }
    >
      <form id="guest-form" onSubmit={submit} className="flex flex-col gap-4" noValidate>
        <InputField
          label="Full name"
          required
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <InputField
            label="Phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
          <InputField
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-[110px_1fr_1fr]">
          <InputField
            label="Nationality"
            maxLength={2}
            hint="e.g. EG"
            value={nationality}
            onChange={(e) => setNationality(e.target.value)}
          />
          <SelectField
            label="ID document"
            value={docType}
            onChange={(e) => setDocType(e.target.value as IdDocumentType | "")}
          >
            <option value="">None</option>
            <option value="national_id">National ID</option>
            <option value="passport">Passport</option>
          </SelectField>
          <InputField
            label="Document number"
            value={docNumber}
            onChange={(e) => setDocNumber(e.target.value)}
          />
        </div>
        <TextAreaField
          label="Preferences"
          value={preferences}
          onChange={(e) => setPreferences(e.target.value)}
        />
        <CheckboxField label="VIP guest" checked={vip} onChange={(e) => setVip(e.target.checked)} />
        <FormError message={error} />
      </form>
    </Dialog>
  );
}
