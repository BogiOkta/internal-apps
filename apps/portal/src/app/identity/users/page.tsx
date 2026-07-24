"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { GridFooter, GridStateRows } from "@/components/admin-data-grid";
import { useAuth } from "@/components/auth-provider";
import { FormField, formControlClassName } from "@/components/form-field";
import { VacationWorkspace } from "@/features/vacation/components/vacation-workspace";
import { useTranslations } from "@/i18n/use-translations";
import { activateUser, ApiError, createUser, deactivateUser, listUsers } from "@/services/auth";
import { usersManagePermission, type ManagedUser } from "@/types/auth";

export default function UsersPage() {
  const { accessToken, user } = useAuth();
  const { t } = useTranslations();
  const allowed = user?.permissions.includes(usersManagePermission) ?? false;
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [selected, setSelected] = useState<ManagedUser | null>(null);
  const [creating, setCreating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [confirmingState, setConfirmingState] = useState(false);
  const load = useCallback(async () => {
    if (!accessToken || !allowed) return;
    setLoading(true); setError(null);
    try {
      const rows = await listUsers(accessToken); setUsers(rows);
      setSelected((current) => current
        ? rows.find((item) => item.publicId === current.publicId) ?? null : null);
    } catch { setError(t("identity.users.loadFailed")); }
    finally { setLoading(false); }
  }, [accessToken, allowed, t]);
  useEffect(() => { void load(); }, [load]);

  async function setActive() {
    if (!accessToken || !selected) return;
    setError(null);
    try {
      if (selected.isActive) await deactivateUser(accessToken, selected.publicId);
      else await activateUser(accessToken, selected.publicId);
      setSuccess(selected.isActive ? t("identity.users.deactivated") : t("identity.users.activated"));
      setConfirmingState(false); await load();
    } catch { setError(t("identity.users.stateFailed")); }
  }

  if (!allowed) return <VacationWorkspace title={t("identity.users.title")}>
    <div role="alert" className="rounded-md border border-red-200 bg-red-50 p-4 text-red-800">
      {t("identity.users.forbidden")}</div></VacationWorkspace>;

  return <VacationWorkspace title={t("identity.users.title")}
    description={t("identity.users.description")}
    commandBar={<button type="button" onClick={() => { setCreating(true); setSelected(null); }}
      className="min-h-9 rounded-md bg-blue-700 px-3 text-sm font-semibold text-white">
      {t("identity.users.new")}</button>}>
    {error && <div role="alert" className="mb-3 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>}
    {success && <div role="status" className="mb-3 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{success} <Link className="font-semibold underline" href="/organization/user-employee-links">{t("identity.users.linkEmployee")}</Link></div>}
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <section className="overflow-hidden rounded-lg border border-slate-300 bg-white">
        <table className="w-full text-left text-sm"><thead className="bg-slate-100 text-xs uppercase text-slate-600">
          <tr><th className="px-4 py-3">{t("identity.users.username")}</th>
            <th className="px-4 py-3">{t("identity.users.displayName")}</th>
            <th className="px-4 py-3">{t("identity.users.roles")}</th>
            <th className="px-4 py-3">{t("identity.users.status")}</th></tr></thead>
          <tbody className="divide-y divide-slate-200">
            <GridStateRows columnCount={4} isLoading={loading} hasError={Boolean(error)}
              isEmpty={users.length === 0} loadingLabel={t("common.loading")}
              emptyTitle={t("identity.users.empty")} emptyDescription={t("identity.users.emptyDescription")} />
            {!loading && !error && users.map((item) => <tr key={item.publicId}
              className={selected?.publicId === item.publicId ? "bg-blue-50" : ""}>
              <td className="px-4 py-3"><button type="button" onClick={() => { setSelected(item); setCreating(false); setConfirmingState(false); }}
                className="font-semibold text-blue-700 hover:underline">{item.username}</button></td>
              <td className="px-4 py-3">{item.displayName}</td>
              <td className="px-4 py-3">{item.roles.join(", ")}</td>
              <td className="px-4 py-3">{item.isActive ? t("identity.users.active") : t("identity.users.inactive")}</td>
            </tr>)}
          </tbody></table>
        <GridFooter countLabel={t("identity.users.count", { count: users.length })}
          selectionLabel={selected ? t("identity.users.selected", { name: selected.username }) : t("identity.users.selectHint")} />
      </section>
      <aside className="rounded-lg border border-slate-300 bg-white p-4">
        {creating ? <CreateUserForm onCancel={() => setCreating(false)}
          onCreated={async () => { setCreating(false); setSuccess(t("identity.users.created")); await load(); }} /> :
          selected ? <div className="space-y-3 text-sm"><h2 className="text-lg font-semibold">{selected.displayName}</h2>
            <p>{selected.username}</p><p>{selected.roles.join(", ")}</p>
            <button type="button" onClick={() => setConfirmingState(true)}
              className="min-h-9 rounded-md border border-slate-300 px-3 font-medium">
              {selected.isActive ? t("identity.users.deactivate") : t("identity.users.activate")}</button>
            {confirmingState && <div className="rounded-md border border-amber-200 bg-amber-50 p-3">
              <p>{selected.isActive ? t("identity.users.deactivateConfirm") : t("identity.users.activateConfirm")}</p>
              <div className="mt-2 flex gap-2"><button type="button" onClick={() => void setActive()}
                className="min-h-9 rounded-md bg-blue-700 px-3 font-semibold text-white">{t("vacation.employees.confirm")}</button>
                <button type="button" onClick={() => setConfirmingState(false)}
                  className="min-h-9 rounded-md border border-slate-300 px-3">{t("vacation.employees.cancel")}</button></div>
            </div>}</div> :
          <p className="text-sm text-slate-600">{t("identity.users.selectHint")}</p>}
      </aside>
    </div>
  </VacationWorkspace>;
}

function CreateUserForm({ onCancel, onCreated }: {
  onCancel: () => void; onCreated: () => Promise<void>;
}) {
  const { accessToken } = useAuth(); const { t } = useTranslations();
  const [username, setUsername] = useState(""); const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState(""); const [confirm, setConfirm] = useState("");
  const [active, setActive] = useState(true); const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setError(null); setFieldErrors({});
    const clientErrors: Record<string, string> = {};
    if (!username.trim()) clientErrors.username = t("identity.users.usernameRequired");
    if (!displayName.trim()) clientErrors.displayName = t("identity.users.displayNameRequired");
    if (password.length < 12) clientErrors.initialPassword = t("identity.users.passwordMinimum");
    if (password !== confirm) clientErrors.confirmPassword = t("identity.users.passwordMismatch");
    if (Object.keys(clientErrors).length > 0) { setFieldErrors(clientErrors); return; }
    if (!accessToken) { setError(t("identity.users.saveFailed")); return; }
    try {
      await createUser(accessToken, { username, displayName, initialPassword: password, isActive: active });
      setPassword(""); setConfirm(""); await onCreated();
    } catch (cause) {
      if (cause instanceof ApiError && cause.problem?.code === "identity_username_conflict") {
        setFieldErrors({ username: t("identity.users.duplicate") });
        return;
      }
      if (cause instanceof ApiError && cause.problem?.code === "validation_failed") {
        const serverErrors: Record<string, string> = {};
        if (cause.problem.errors?.username) serverErrors.username = t("identity.users.usernameRequired");
        if (cause.problem.errors?.displayName) serverErrors.displayName = t("identity.users.displayNameRequired");
        if (cause.problem.errors?.initialPassword) serverErrors.initialPassword = t("identity.users.passwordMinimum");
        if (Object.keys(serverErrors).length > 0) { setFieldErrors(serverErrors); return; }
      }
      setError(t("identity.users.saveFailed"));
    }
  }
  const field = (id: string, name: string, label: string, value: string,
    set: (v: string) => void, type = "text") => {
    const fieldError = fieldErrors[name];
    return <FormField id={id} label={label} required error={fieldError}>
      <input id={id} type={type} value={value} aria-invalid={Boolean(fieldError)}
        aria-describedby={fieldError ? `${id}-error` : undefined}
        onChange={(event) => { set(event.target.value); setFieldErrors((current) => {
          const next = { ...current }; delete next[name]; return next;
        }); }} className={formControlClassName({ invalid: Boolean(fieldError) })} /></FormField>;
  };
  return <form onSubmit={submit} className="space-y-4"><h2 className="text-lg font-semibold">{t("identity.users.new")}</h2>
    {error && <div role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-800">{error}</div>}
    {field("user-username", "username", t("identity.users.username"), username, setUsername)}
    {field("user-display-name", "displayName", t("identity.users.displayName"), displayName, setDisplayName)}
    {field("user-password", "initialPassword", t("identity.users.initialPassword"), password, setPassword, "password")}
    {field("user-password-confirm", "confirmPassword", t("identity.users.confirmPassword"), confirm, setConfirm, "password")}
    <label className="flex gap-2 text-sm"><input type="checkbox" checked={active}
      onChange={(event) => setActive(event.target.checked)} />{t("identity.users.initiallyActive")}</label>
    <div className="flex gap-2"><button className="min-h-9 rounded-md bg-blue-700 px-3 font-semibold text-white">{t("vacation.employees.save")}</button>
      <button type="button" onClick={onCancel} className="min-h-9 rounded-md border border-slate-300 px-3">{t("vacation.employees.cancel")}</button></div>
  </form>;
}
