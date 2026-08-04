"use client";

import Link from "next/link";
import { OrganizationWorkspace } from "@/features/organization/components/organization-workspace";
import { useAuth } from "@/components/auth-provider";
import type { TranslationKey } from "@/i18n/translations";
import { useTranslations } from "@/i18n/use-translations";
import {
  filterVisibleSections,
  organizationWorkspace,
} from "@/navigation";

const sectionDescriptions: Record<string, TranslationKey> = {
  departments: "organization.overview.section.departments",
  employees: "organization.overview.section.employees",
  "non-working-days": "organization.overview.section.nonWorkingDays",
  "user-employee-links": "organization.overview.section.userEmployeeLinks",
};

/**
 * Organization overview — orientation for company master data. Section links
 * are permission-filtered and point at existing workspace destinations.
 */
export default function OrganizationOverviewPage() {
  const { user } = useAuth();
  const { t } = useTranslations();
  const sections = filterVisibleSections(
    organizationWorkspace.sections,
    user?.permissions ?? [],
  ).filter((section) => section.id !== "overview");

  return (
    <OrganizationWorkspace
      title={t("organization.overview.title")}
      description={t("organization.overview.description")}
    >
      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {sections.map((section) => {
          const descriptionKey = sectionDescriptions[section.id];
          return (
            <li key={section.id}>
              <Link
                href={section.route}
                className="block rounded-xl border border-slate-300 bg-white px-4 py-4 shadow-sm transition hover:border-blue-300 hover:bg-blue-50/40 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2"
              >
                <span className="block text-sm font-semibold text-slate-950">
                  {t(section.labelKey)}
                </span>
                {descriptionKey ? (
                  <span className="mt-1 block text-sm leading-5 text-slate-600">
                    {t(descriptionKey)}
                  </span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </OrganizationWorkspace>
  );
}
