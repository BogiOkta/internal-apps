"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { VacationWorkspace } from "@/features/vacation/components/vacation-workspace";
import { useTranslations } from "@/i18n/use-translations";
import { getDepartments } from "@/services/organization";
import type { Department } from "@/types/organization";

export default function DepartmentsPage() {
  const { accessToken } = useAuth();
  const { t } = useTranslations();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  useEffect(() => {
    if (!accessToken) return;
    const controller = new AbortController();
    setLoading(true); setError(false);
    getDepartments(accessToken, { sort: "name" }, controller.signal)
      .then(setDepartments).catch(() => { if (!controller.signal.aborted) setError(true); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [accessToken]);

  return <VacationWorkspace title={t("organization.departments.title")}
    description={t("organization.departments.description")}>
    <section className="overflow-hidden rounded-lg border border-slate-300 bg-white shadow-sm">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-slate-300 bg-slate-100 text-xs uppercase text-slate-600">
          <tr><th className="px-4 py-3">{t("organization.departments.code")}</th>
            <th className="px-4 py-3">{t("organization.departments.name")}</th></tr>
        </thead>
        <tbody className="divide-y divide-slate-200">
          {loading && <tr><td colSpan={2} className="px-4 py-8 text-center">{t("common.loading")}</td></tr>}
          {error && <tr><td colSpan={2} className="px-4 py-8 text-center text-red-700">{t("organization.departments.error")}</td></tr>}
          {!loading && !error && departments.length === 0 && <tr><td colSpan={2} className="px-4 py-8 text-center text-slate-500">{t("organization.departments.empty")}</td></tr>}
          {!loading && !error && departments.map((department) =>
            <tr key={department.publicId}><td className="px-4 py-3 font-medium">{department.code}</td>
              <td className="px-4 py-3">{department.name}</td></tr>)}
        </tbody>
      </table>
    </section>
  </VacationWorkspace>;
}
