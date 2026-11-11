import { SettingsForm } from "@/components/settings-form";
import { requireUser } from "@/lib/auth";

export default async function SettingsPage() {
  const user = await requireUser();
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-slate-500">These details appear on every invoice your clients see.</p>
      </div>
      <SettingsForm
        user={{
          name: user.name,
          businessName: user.businessName,
          businessEmail: user.businessEmail,
          businessAddress: user.businessAddress,
          paymentInstructions: user.paymentInstructions,
          paymentLink: user.paymentLink,
          defaultCurrency: user.defaultCurrency,
        }}
      />
    </div>
  );
}
