import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "RewardConnection",
    short_name: "RewardConnect",
    description: "Missions, jetons et temps Internet familial",
    start_url: "/",
    display: "standalone",
    background_color: "#f4f7fb",
    theme_color: "#3457d5",
    lang: "fr",
    categories: ["productivity", "lifestyle"],
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/icon-maskable.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
  };
}
