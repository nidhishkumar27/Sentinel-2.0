import type { IconName } from "../../../components/ui/Icon";

export type DemoResource = {
  title: string;
  description: string;
  icon: IconName;
  tone: "blue" | "green" | "amber";
};

export const demoDashboardData: {
  resources: DemoResource[];
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
};
