/** Current status of the maintenance mode. */
export type MaintenanceStatusResponse = {
  enabled: boolean;
  message: string | null;
  estimatedEndAt: string | null;
  updatedAt: string | null;
};

/** Public system status payload. */
export type SystemStatusResponse = {
  maintenance: MaintenanceStatusResponse;
  serverTime: string;
};
