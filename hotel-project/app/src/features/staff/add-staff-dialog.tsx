import { useState, type FormEvent } from "react";
import { useAddStaff, useRoleMatrix } from "@/api/staff";
import { useAuth } from "@/features/auth/use-auth";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { FormError, InputField, SelectField } from "@/components/ui/fields";
import { errorMessage } from "@/lib/errors";
import { useToast } from "@/components/ui/toast";

/**
 * Add a staff member: creates their HotelOS account (Core identity) with a temporary password the
 * manager hands over, and gives them one role. Only an owner is offered the Owner role — the
 * server enforces the same rule.
 */
export function AddStaffDialog({ onClose }: { onClose: () => void }) {
  const auth = useAuth();
  const roles = useRoleMatrix();
  const add = useAddStaff();
  const toast = useToast();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [roleKey, setRoleKey] = useState("receptionist");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const options = (roles.data?.roles ?? []).filter(
    (r) => r.key !== "owner" || auth.can("manage:role"),
  );

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 10) {
      setError("The temporary password needs at least 10 characters.");
      return;
    }
    try {
      await add.mutateAsync({
        fullName: fullName.trim(),
        email: email.trim(),
        roleKey,
        temporaryPassword: password,
      });
      toast(`${fullName.trim()} added to staff`);
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <Dialog
      open
      title="Add staff member"
      description="They sign in with this email and the temporary password you give them."
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" type="submit" form="add-staff-form" disabled={add.isPending}>
            {add.isPending ? "Adding…" : "Add staff"}
          </Button>
        </>
      }
    >
      <form id="add-staff-form" onSubmit={submit} className="flex flex-col gap-4">
        <InputField
          label="Full name"
          required
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
        />
        <InputField
          label="Work email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <SelectField label="Role" value={roleKey} onChange={(e) => setRoleKey(e.target.value)}>
          {options.map((r) => (
            <option key={r.key} value={r.key}>
              {r.name}
            </option>
          ))}
        </SelectField>
        <InputField
          label="Temporary password"
          type="password"
          autoComplete="new-password"
          required
          hint="At least 10 characters"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <FormError message={error} />
      </form>
    </Dialog>
  );
}
