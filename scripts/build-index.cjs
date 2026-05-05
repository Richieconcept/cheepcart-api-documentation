const fs = require("fs");
const path = require("path");

let yaml;
try {
  yaml = require("js-yaml");
} catch {
  yaml = require(path.resolve(__dirname, "../../node_modules/js-yaml"));
}

const root = path.resolve(__dirname, "..");

const readYaml = (filePath) => {
  const raw = fs.readFileSync(filePath, "utf8");
  return yaml.load(raw);
};

const infoSeq = (item) => {
  const seq = Number(item?.info?.seq);
  return Number.isFinite(seq) ? seq : 9999;
};

const bySeqThenName = (a, b) => {
  const seqDiff = infoSeq(a) - infoSeq(b);
  if (seqDiff !== 0) return seqDiff;
  return String(a?.info?.name || "").localeCompare(String(b?.info?.name || ""));
};

const collection = readYaml(path.join(root, "opencollection.yml"));

const environmentsDir = path.join(root, "environments");
if (fs.existsSync(environmentsDir)) {
  const environments = fs
    .readdirSync(environmentsDir)
    .filter((name) => name.endsWith(".yml"))
    .map((name) => readYaml(path.join(environmentsDir, name)));

  if (environments.length > 0) {
    collection.config = collection.config || {};
    collection.config.environments = environments;
  }
}

collection.items = fs
  .readdirSync(root, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .filter((entry) => ![".git", "environments", "scripts", "node_modules"].includes(entry.name))
  .map((entry) => {
    const folderPath = path.join(root, entry.name);
    const folderFile = path.join(folderPath, "folder.yml");

    if (!fs.existsSync(folderFile)) return null;

    const folder = readYaml(folderFile);
    folder.items = fs
      .readdirSync(folderPath)
      .filter((name) => name.endsWith(".yml") && name !== "folder.yml")
      .map((name) => readYaml(path.join(folderPath, name)))
      .sort(bySeqThenName);

    return folder;
  })
  .filter(Boolean)
  .sort(bySeqThenName);

collection.bundled = true;
collection.extensions = collection.extensions || {};
collection.extensions.bruno = collection.extensions.bruno || {};
collection.extensions.bruno.ignore = collection.extensions.bruno.ignore || ["node_modules", ".git"];
collection.extensions.bruno.presets = {
  requestType: "http",
  requestUrl: "https://cheepcart-project.onrender.com",
};
collection.extensions.bruno.exportedUsing = "Codex docs refresh";

const collectionYaml = yaml.dump(collection, {
  lineWidth: -1,
  noRefs: true,
  sortKeys: false,
});

const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>CHEEPCART-BACKEND - API Documentation</title>
    <style>
        body { margin: 0; padding: 0; }
        #opencollection-container { width: 100vw; height: 100vh; }
    </style>
    <link rel="stylesheet" href="https://cdn.opencollection.com/docs.css">
    <script src="https://cdn.opencollection.com/docs.js"></script>
</head>
<body>
    <div id="opencollection-container"></div>
    <script>
        const collectionData = ${JSON.stringify(collectionYaml)};
        new window.OpenCollection({
            target: document.getElementById('opencollection-container'),
            opencollection: collectionData,
            theme: 'light'
        });
    </script>
</body>
</html>
`;

fs.writeFileSync(path.join(root, "index.html"), html, "utf8");

console.log(`Wrote ${path.join(root, "index.html")}`);
