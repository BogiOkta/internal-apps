"use client";

import { useParams } from "next/navigation";
import { AdminVacationRequestDetails } from "@/features/vacation/components/admin-vacation-request-details";

export default function AdminVacationRequestDetailsPage() {
  const { requestId } = useParams<{ requestId: string }>();
  return <AdminVacationRequestDetails requestId={requestId} />;
}
