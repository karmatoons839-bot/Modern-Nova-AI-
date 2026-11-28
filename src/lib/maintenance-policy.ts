export const MAINTENANCE_MESSAGE = "Website par kaam chal raha hai. Please try again later.";
export function maintenanceBlocks(enabled: boolean, ownerAdmin: boolean) {
  return enabled && !ownerAdmin;
}
export function isServiceIssue(status: number) {
  return status === 402 || status === 401 || status === 403 || status === 429 || status >= 500;
}