export interface RuntimeShutdownTarget {
  shutdown(): Promise<void>;
}

export interface RuntimeLease<TRuntime extends RuntimeShutdownTarget> {
  readonly generation: number;
  readonly runtime: TRuntime;
  released: boolean;
}

/**
 * Coordinates React effect ownership without treating StrictMode cleanup as
 * proof that the application runtime is no longer active.
 */
export class RuntimeLifecycleCoordinator<
  TRuntime extends RuntimeShutdownTarget,
> {
  private nextGeneration = 0;
  private activeLease: RuntimeLease<TRuntime> | null = null;

  public claim(runtime: TRuntime): RuntimeLease<TRuntime> {
    const lease: RuntimeLease<TRuntime> = {
      generation: ++this.nextGeneration,
      runtime,
      released: false,
    };
    this.activeLease = lease;
    return lease;
  }

  public release(
    lease: RuntimeLease<TRuntime>,
    shutdown: (runtime: TRuntime) => void,
  ): void {
    if (lease.released) {
      return;
    }
    lease.released = true;

    queueMicrotask(() => {
      const activeLease = this.activeLease;

      // A StrictMode cleanup can run immediately before a new setup. If that
      // setup reclaimed the same runtime, the old cleanup must do nothing.
      if (
        activeLease?.runtime === lease.runtime &&
        activeLease.generation !== lease.generation
      ) {
        return;
      }

      if (
        activeLease?.runtime === lease.runtime &&
        activeLease.generation === lease.generation
      ) {
        this.activeLease = null;
      }

      // A different runtime may already be active. The released lease still
      // owns only its captured runtime and may clean up that instance.
      shutdown(lease.runtime);
    });
  }
}
