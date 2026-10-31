import type { MetadataRoute } from "next";

const site = "https://infera-omega.vercel.app";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: site, changeFrequency: "monthly", priority: 1 },
    { url: `${site}/about`, changeFrequency: "yearly", priority: 0.7 },
    { url: `${site}/docs`, changeFrequency: "monthly", priority: 0.7 },
  ];
}
