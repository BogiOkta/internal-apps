export const businessCalendarManagePermission = "identity.users.manage";

export type NonWorkingDay = {
  publicId: string;
  date: string;
  name: string;
  description: string | null;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
};

export type SaveNonWorkingDayRequest = {
  date: string;
  name: string;
  description: string | null;
};
