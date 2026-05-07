import fs from "fs";
import path from "path";
import { HelpDrawerClient, type Article } from "./HelpDrawerClient";

function titleFromContent(content: string): string {
  const match = content.match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : "Untitled";
}

function loadArticles(): Article[] {
  const helpDir = path.join(process.cwd(), "docs", "help");
  const articles: Article[] = [];

  const sectionDirs = fs.readdirSync(helpDir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith("_"))
    .map((d) => d.name)
    .sort();

  for (const section of sectionDirs) {
    const sectionPath = path.join(helpDir, section);
    const files = fs.readdirSync(sectionPath)
      .filter((f) => f.endsWith(".md") && !f.startsWith("_"))
      .sort();

    for (const file of files) {
      const content = fs.readFileSync(path.join(sectionPath, file), "utf8");
      const slug = `${section}/${file.replace(/\.md$/, "")}`;
      articles.push({
        slug,
        title: titleFromContent(content),
        section,
        sectionLabel: section,
        content,
      });
    }
  }

  return articles;
}

export default function HelpDrawerTestPage() {
  const articles = loadArticles();
  return <HelpDrawerClient articles={articles} />;
}
