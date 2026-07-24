"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { SearchableCombobox } from "@/components/searchable-combobox";
import { VacationWorkspace } from "@/features/vacation/components/vacation-workspace";
import { useTranslations } from "@/i18n/use-translations";
import {
  createUserEmployeeLink, getUserEmployeeLinkOptions, getUserEmployeeLinks,
  unlinkUserEmployee, updateUserEmployeeLink,
} from "@/services/organization";
import {
  userEmployeeLinksManagePermission, type UserEmployeeLink,
  type UserEmployeeLinkOptions,
} from "@/types/organization";

export default function UserEmployeeLinksPage() {
  const { accessToken, user } = useAuth();
  const { t } = useTranslations();
  const allowed = user?.permissions.includes(userEmployeeLinksManagePermission) ?? false;
  const [links, setLinks] = useState<UserEmployeeLink[]>([]);
  const [options, setOptions] = useState<UserEmployeeLinkOptions>({ users: [], employees: [] });
  const [selected, setSelected] = useState<UserEmployeeLink | null>(null);
  const [userId, setUserId] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmingUnlink, setConfirmingUnlink] = useState(false);

  const load = useCallback(async () => {
    if (!accessToken || !allowed) return;
    setLoading(true); setError(null);
    try {
      const [linkRows, optionRows] = await Promise.all([
        getUserEmployeeLinks(accessToken), getUserEmployeeLinkOptions(accessToken),
      ]);
      setLinks(linkRows); setOptions(optionRows);
      setSelected((current) => current
        ? linkRows.find((row) => row.publicId === current.publicId) ?? null : null);
    } catch { setError(t("organization.links.loadFailed")); }
    finally { setLoading(false); }
  }, [accessToken, allowed, t]);
  useEffect(() => { void load(); }, [load]);

  const userOptions = useMemo(() => options.users.map((item) => ({
    value: item.publicId, label: item.displayName,
    description: item.username, disabled: !item.isActive,
  })), [options.users]);
  const employeeOptions = useMemo(() => options.employees.map((item) => ({
    value: item.publicId, label: `${item.firstName} ${item.lastName}`,
    description: `${item.employeeNumber} · ${item.departmentName}`, disabled: !item.isActive,
  })), [options.employees]);

  function beginCreate() { setSelected(null); setUserId(""); setEmployeeId(""); setError(null); setConfirmingUnlink(false); }
  function beginEdit(link: UserEmployeeLink) {
    setSelected(link); setUserId(link.userPublicId); setEmployeeId(link.employee.publicId); setError(null); setConfirmingUnlink(false);
  }
  async function save() {
    if (!accessToken || !userId || !employeeId) {
      setError(t("organization.links.required")); return;
    }
    setSaving(true); setError(null);
    try {
      if (selected) await updateUserEmployeeLink(accessToken, selected.publicId, userId, employeeId);
      else await createUserEmployeeLink(accessToken, userId, employeeId);
      beginCreate(); await load();
    } catch (cause) {
      const code = cause && typeof cause === "object" && "problem" in cause
        ? (cause as { problem?: { code?: string } }).problem?.code : undefined;
      setError(code === "user_employee_link_user_conflict" ? t("organization.links.userConflict")
        : code === "user_employee_link_employee_conflict" ? t("organization.links.employeeConflict")
        : code === "user_employee_link_employee_inactive" ? t("organization.links.inactiveEmployee")
        : t("organization.links.saveFailed"));
    } finally { setSaving(false); }
  }
  async function unlink(link: UserEmployeeLink) {
    if (!accessToken) return;
    setSaving(true); setError(null);
    try { await unlinkUserEmployee(accessToken, link.publicId); beginCreate(); await load(); }
    catch { setError(t("organization.links.unlinkFailed")); }
    finally { setSaving(false); }
  }

  if (!allowed) return <VacationWorkspace title={t("organization.links.title")}>
    <div role="alert" className="rounded-md border border-red-200 bg-red-50 p-4 text-red-800">
      {t("organization.links.forbidden")}
    </div></VacationWorkspace>;

  return <VacationWorkspace title={t("organization.links.title")}
    description={t("organization.links.description")}
    commandBar={<button type="button" onClick={beginCreate}
      className="min-h-9 rounded-md bg-blue-700 px-3 text-sm font-semibold text-white">
      {t("organization.links.new")}</button>}>
    {error && <div role="alert" className="mb-3 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>}
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_24rem]">
      <section className="overflow-hidden rounded-lg border border-slate-300 bg-white">
        <table className="w-full text-left text-sm"><thead className="bg-slate-100 text-xs uppercase text-slate-600">
          <tr><th className="px-4 py-3">{t("organization.links.user")}</th>
            <th className="px-4 py-3">{t("organization.links.employee")}</th>
            <th className="px-4 py-3">{t("vacation.employees.department")}</th>
            <th className="px-4 py-3">{t("vacation.employees.status")}</th></tr></thead>
          <tbody className="divide-y divide-slate-200">
            {loading && <tr><td colSpan={4} className="px-4 py-8 text-center">{t("common.loading")}</td></tr>}
            {!loading && links.length === 0 && <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-500">{t("organization.links.empty")}</td></tr>}
            {!loading && links.map((link) => <tr key={link.publicId}>
              <td className="px-4 py-3"><button type="button" onClick={() => beginEdit(link)}
                className="font-semibold text-blue-700 hover:underline">{link.userDisplayName}</button>
                <span className="block text-xs text-slate-500">{link.username}</span></td>
              <td className="px-4 py-3">{link.employee.firstName} {link.employee.lastName}
                <span className="block text-xs text-slate-500">{link.employee.employeeNumber}</span></td>
              <td className="px-4 py-3">{link.employee.departmentName}</td>
              <td className="px-4 py-3">{link.employee.employmentStatus === "Active"
                ? t("vacation.employees.active") : t("vacation.employees.inactive")}</td></tr>)}
          </tbody></table>
      </section>
      <aside className="rounded-lg border border-slate-300 bg-white p-4">
        <h2 className="mb-4 text-lg font-semibold">{selected
          ? t("organization.links.edit") : t("organization.links.new")}</h2>
        <div className="space-y-4">
          <SearchableCombobox label={t("organization.links.user")} value={userId}
            options={userOptions} placeholder={t("organization.links.searchUser")}
            emptyText={t("organization.links.noOptions")} clearLabel={t("organization.links.clear")}
            onChange={setUserId} />
          <SearchableCombobox label={t("organization.links.employee")} value={employeeId}
            options={employeeOptions} placeholder={t("organization.links.searchEmployee")}
            emptyText={t("organization.links.noOptions")} clearLabel={t("organization.links.clear")}
            onChange={setEmployeeId} />
          <div className="flex flex-wrap gap-2"><button type="button" disabled={saving}
            onClick={() => void save()} className="min-h-9 rounded-md bg-blue-700 px-3 text-sm font-semibold text-white disabled:opacity-50">
            {t("vacation.employees.save")}</button>
            {selected && <button type="button" disabled={saving} onClick={() => setConfirmingUnlink(true)}
              className="min-h-9 rounded-md border border-slate-300 px-3 text-sm font-medium">
              {t("organization.links.unlink")}</button>}</div>
          {selected && confirmingUnlink && <div className="rounded-md border border-amber-200 bg-amber-50 p-3">
            <p className="text-sm text-amber-900">{t("organization.links.unlinkConfirmation")}</p>
            <div className="mt-2 flex gap-2"><button type="button" disabled={saving}
              onClick={() => void unlink(selected)} className="min-h-9 rounded-md bg-blue-700 px-3 text-sm font-semibold text-white">
              {t("vacation.employees.confirm")}</button>
              <button type="button" onClick={() => setConfirmingUnlink(false)}
                className="min-h-9 rounded-md border border-slate-300 px-3 text-sm">
                {t("vacation.employees.cancel")}</button></div>
          </div>}
        </div>
      </aside>
    </div>
  </VacationWorkspace>;
}
