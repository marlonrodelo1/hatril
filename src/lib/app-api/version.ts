/** Contrato de `GET /api/v1/app/version`. Ver `src/lib/app-api/yo.ts`. */
export type RespuestaVersion = {
  /** Semver, como el `versionName` de Android y el de iOS. */
  minima: string;
};
