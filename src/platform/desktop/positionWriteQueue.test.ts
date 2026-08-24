import { describe, expect, it, vi } from "vitest";
import { PositionWriteQueue } from "./positionWriteQueue";

function deferred() {
  let resolve!: () => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<void>((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });
  return { promise, resolve, reject };
}

describe("PositionWriteQueue", () => {
  it("serializes movement and lets layout invalidate stale movement", async () => {
    const firstWrite = deferred();
    const write = vi
      .fn()
      .mockReturnValueOnce(firstWrite.promise)
      .mockResolvedValue(undefined);
    const queue = new PositionWriteQueue(write);

    const first = queue.enqueueMovement({ x: 10, y: 20 });
    const second = queue.enqueueMovement({ x: 11, y: 20 });
    const layoutLease = queue.acquire("LAYOUT");

    expect(queue.debugSnapshot.owner).toBe("LAYOUT");
    expect(queue.debugSnapshot.queueLength).toBe(1);

    firstWrite.resolve();
    await Promise.all([first, second, layoutLease]);

    await queue.writeLayout({ x: 100, y: 200 });
    queue.release("LAYOUT");

    expect(write).toHaveBeenNthCalledWith(1, { x: 10, y: 20 });
    expect(write).toHaveBeenNthCalledWith(2, { x: 100, y: 200 });
    expect(queue.debugSnapshot.owner).toBeNull();
    expect(queue.debugSnapshot.writeInFlight).toBe(false);
  });

  it("blocks movement while hidden and releases the queue after failure", async () => {
    const error = new Error("position failed");
    const write = vi.fn().mockRejectedValueOnce(error);
    const queue = new PositionWriteQueue(write);

    await expect(queue.enqueueMovement({ x: 5, y: 6 })).rejects.toBe(error);
    expect(queue.debugSnapshot.writeInFlight).toBe(false);

    queue.setHidden();
    await queue.enqueueMovement({ x: 9, y: 10 });
    expect(write).toHaveBeenCalledTimes(1);
    expect(queue.debugSnapshot.owner).toBe("HIDDEN");

    queue.setVisible();
    const acquired = await queue.acquire("LAYOUT");
    expect(acquired).toBe(true);
    queue.release("LAYOUT");
    expect(queue.debugSnapshot.owner).toBeNull();
  });
});
