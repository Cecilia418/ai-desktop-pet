export type PetVitalName = "hunger" | "mood" | "energy";

export interface VitalPresentation {
  readonly label: string;
  readonly tone: "primary" | "yellow" | "blue" | "pink";
}

function safeValue(value: number): number {
  return Number.isFinite(value) ? value : 0;
}

export function mapHungerPresentation(value: number): VitalPresentation {
  const safe = safeValue(value);
  if (safe >= 80) {
    return { label: "吃得饱饱的", tone: "primary" };
  }
  if (safe >= 50) {
    return { label: "还不错", tone: "primary" };
  }
  if (safe >= 20) {
    return { label: "有点饿", tone: "yellow" };
  }
  return { label: "肚子空空的", tone: "pink" };
}

export function mapMoodPresentation(value: number): VitalPresentation {
  const safe = safeValue(value);
  if (safe >= 80) {
    return { label: "很开心", tone: "pink" };
  }
  if (safe >= 50) {
    return { label: "心情不错", tone: "pink" };
  }
  if (safe >= 20) {
    return { label: "有点闷", tone: "blue" };
  }
  return { label: "不太开心", tone: "blue" };
}

export function mapEnergyPresentation(value: number): VitalPresentation {
  const safe = safeValue(value);
  if (safe >= 80) {
    return { label: "精神满满", tone: "blue" };
  }
  if (safe >= 50) {
    return { label: "还挺有精神", tone: "blue" };
  }
  if (safe >= 20) {
    return { label: "有点困", tone: "yellow" };
  }
  return { label: "快睡着啦", tone: "pink" };
}

export function mapVitalPresentation(
  vital: PetVitalName,
  value: number,
): VitalPresentation {
  switch (vital) {
    case "hunger":
      return mapHungerPresentation(value);
    case "mood":
      return mapMoodPresentation(value);
    case "energy":
      return mapEnergyPresentation(value);
  }
}
