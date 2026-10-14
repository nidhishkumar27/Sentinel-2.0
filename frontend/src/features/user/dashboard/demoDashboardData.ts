import type { IconName } from "../../../components/ui/Icon";

export type DemoResource = {
  title: string;
  description: string;
  icon: IconName;
  tone: "blue" | "green" | "amber";
};

export type DemoAlert = {
  title: string;
  description: string;
  icon: IconName;
  tone: "amber" | "blue";
};

export const demoDashboardData: {
  resources: DemoResource[];
  alerts: DemoAlert[];
} = {
  resources: [
    {
      title: "Medical support",
      description: "Example of a nearby-care resource",
      icon: "medical",
      tone: "green",
    },
    {
      title: "Police assistance",
      description: "Example of a local-assistance resource",
      icon: "police",
      tone: "blue",
    },
    {
      title: "Tourist help desk",
      description: "Example of a visitor-support resource",
      icon: "tourist",
      tone: "amber",
    },
  ],
  alerts: [
    {
      title: "Sample travel advisory",
      description:
        "Illustrative alert only. Current local advisories are not connected.",
      icon: "alerts",
      tone: "amber",
    },
    {
      title: "Weather alert preview",
      description:
        "Illustrative card only. No live weather information is available.",
      icon: "sparkle",
      tone: "blue",
    },
  ],
};
