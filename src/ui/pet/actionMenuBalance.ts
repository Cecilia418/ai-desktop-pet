export interface ActionMenuBalanceConfig {
  readonly autoCloseMs: number;
  readonly affordanceGracePeriodMs: number;
  readonly affordanceMinimumVisibleMs: number;
  readonly affordanceHitTargetSize: number;
}

export const DEFAULT_ACTION_MENU_BALANCE: Readonly<ActionMenuBalanceConfig> = {
  autoCloseMs: 5_000,
  affordanceGracePeriodMs: 1_000,
  affordanceMinimumVisibleMs: 2_200,
  affordanceHitTargetSize: 36,
};
