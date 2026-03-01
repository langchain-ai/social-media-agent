import * as cheerio from "cheerio";
import {
  getLatentSpaceLinks,
  putLatentSpaceLinks,
} from "../utils/stores/latent-space-links.js";
import { BaseStore } from "@langchain/langgraph";
import { getUniqueArrayItems } from "../utils/get-unique-array.js";
import { traceable } from "langsmith/traceable";

async function latentSpaceLoaderFunc(store: BaseStore | undefined) {
  const siteMapUrl = `https://www.latent.space/sitemap/${new Date().getFullYear()}`;

  const links = await fetch(siteMapUrl)
    .then((response) => response.text())
    .then((html) => {
      const $ = cheerio.load(html);

      const links = $(".sitemap-link")
        .map((_, element) => $(element).attr("href"))
        .get();

      return links;
    });

  const processedLinks = await getLatentSpaceLinks(store);
  const uniqueLinks = getUniqueArrayItems(processedLinks, links);
  const allLinks = Array.from(new Set([...processedLinks, ...uniqueLinks]));

  await putLatentSpaceLinks(allLinks, store);

  return uniqueLinks;
}

export const latentSpaceLoader = traceable(latentSpaceLoaderFunc, {
  name: "latent-space-loader",
});
