import { useState, type FormEvent } from "react";
import { useSettings, useUpdateSettings, type HotelSettings } from "@/api/settings";
import { useAuth } from "@/features/auth/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { FormError, InputField } from "@/components/ui/fields";
import { PageHeader } from "@/components/ui/page-header";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { errorMessage } from "@/lib/errors";
import { useToast } from "@/components/ui/toast";

/**
 * Hotel settings (a design gap, composed from the design's cards and form fields). Time zone and
 * currency are fixed for v1 (Cairo, EGP) and shown read-only; the tax rate is entered as a
 * percentage and stored as a fraction.
 */
export function SettingsPage() {
  const settings = useSettings();
  if (settings.isLoading) return <LoadingState />;
  if (settings.error || !settings.data) return <ErrorState error={settings.error} />;
  return <SettingsForm initial={settings.data} />;
}

function SettingsForm({ initial }: { initial: HotelSettings }) {
  const auth = useAuth();
  const update = useUpdateSettings();
  const toast = useToast();
  const canEdit = auth.can("update:hotel_settings");
  const [hotelName, setHotelName] = useState(initial.hotelName);
  const [checkInTime, setCheckInTime] = useState(initial.checkInTime);
  const [checkOutTime, setCheckOutTime] = useState(initial.checkOutTime);
  const [taxPct, setTaxPct] = useState(String(Math.round(initial.taxRate * 10000) / 100));
  const [address, setAddress] = useState(initial.address ?? "");
  const [phone, setPhone] = useState(initial.phone ?? "");
  const [email, setEmail] = useState(initial.email ?? "");
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await update.mutateAsync({
        hotelName: hotelName.trim(),
        checkInTime,
        checkOutTime,
        taxRate: Number(taxPct) / 100,
        address: address.trim() || null,
        phone: phone.trim() || null,
        email: email.trim() || null,
      });
      toast("Settings saved");
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <>
      <PageHeader title="Settings" subtitle="How Hotel Nayel operates day to day." />
      <form onSubmit={submit} className="grid max-w-[880px] grid-cols-1 gap-4 lg:grid-cols-2">
        <fieldset disabled={!canEdit} className="contents">
          <Card>
            <CardTitle>Property</CardTitle>
            <div className="flex flex-col gap-4">
              <InputField
                label="Hotel name"
                required
                value={hotelName}
                onChange={(e) => setHotelName(e.target.value)}
              />
              <InputField
                label="Address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
              />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <InputField
                  label="Phone"
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
            </div>
          </Card>
          <Card>
            <CardTitle>Operations &amp; tax</CardTitle>
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-4">
                <InputField
                  label="Check-in from"
                  type="time"
                  required
                  value={checkInTime}
                  onChange={(e) => setCheckInTime(e.target.value)}
                />
                <InputField
                  label="Check-out by"
                  type="time"
                  required
                  value={checkOutTime}
                  onChange={(e) => setCheckOutTime(e.target.value)}
                />
              </div>
              <InputField
                label="VAT (%)"
                type="number"
                min={0}
                max={50}
                step="0.01"
                required
                value={taxPct}
                onChange={(e) => setTaxPct(e.target.value)}
              />
              <div className="grid grid-cols-2 gap-4 text-small">
                <div>
                  <div className="mb-[3px] text-faint">Time zone</div>
                  <div className="font-semibold">{initial.timeZone}</div>
                </div>
                <div>
                  <div className="mb-[3px] text-faint">Currency</div>
                  <div className="font-semibold">{initial.currency}</div>
                </div>
              </div>
            </div>
          </Card>
        </fieldset>
        <div className="flex flex-col gap-3 lg:col-span-2">
          <FormError message={error} />
          {canEdit ? (
            <Button type="submit" className="self-start" disabled={update.isPending}>
              {update.isPending ? "Saving…" : "Save settings"}
            </Button>
          ) : (
            <p className="m-0 text-small text-muted">Only the owner can change these settings.</p>
          )}
        </div>
      </form>
    </>
  );
}
