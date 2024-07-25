import http, { IncomingMessage, ServerResponse } from "http";
import fs from "fs/promises";
import path from "path";
import { parse } from "parse-multipart-data";
import { networkInterfaces } from "os";
import qrcode from "qrcode-terminal";

const UPLOAD_DIR = "files";

const handleIndex = async (_: IncomingMessage, res: ServerResponse) => {
  console.log("GET: index.html");
  const content = await fs.readFile("index.html");
  res.writeHead(200);
  res.end(content);
};

const getBody = (req: IncomingMessage): Promise<Buffer> =>
  new Promise((resolve) => {
    let buf = Buffer.from([]);
    req.on("data", (data) => {
      buf = Buffer.concat([buf, data]);
    });
    req.on("end", () => {
      resolve(buf);
    });
  });
const redirectToTop = (res: ServerResponse) => {
  res.writeHead(302, {
    Location: "/",
  });
  res.end();
};
const handleFiles = async (req: IncomingMessage, res: ServerResponse) => {
  const content_type = req.headers["content-type"];
  if (content_type === undefined) {
    redirectToTop(res);
    return;
  }

  const boundary = content_type.split("boundary=")[1];
  const body = await getBody(req);
  const parts = parse(body, boundary);

  try {
    await fs.mkdir(UPLOAD_DIR);
  } catch {}

  await Promise.all(
    parts
      .filter(
        (
          part
        ): part is typeof part & {
          filename: Exclude<(typeof part)["filename"], undefined>;
        } => part.filename !== undefined
      )
      .filter((part) => part.filename !== "")
      .map(async (part) => {
        fs.writeFile(path.join(UPLOAD_DIR, part.filename), part.data);
        console.log("recieved:", part.filename);
      })
  );

  redirectToTop(res);
};

const httpHandler = async (req: IncomingMessage, res: ServerResponse) => {
  if (req.url === "/") return await handleIndex(req, res);
  if (req.url === "/files") return await handleFiles(req, res);
};

const getIPAddrs = () => {
  const nets = networkInterfaces();

  return Object.entries(nets)
    .map((entry) => entry[1])
    .filter((net): net is Exclude<typeof net, undefined> => net !== undefined)
    .reduce((net1, net2) => [...net1, ...net2], [])
    .filter((net) => net.family === "IPv4")
    .map((net) => net.address);
};

const printQR = (ip_addr: string) => {
  const url = new URL("http://example.com");
  url.hostname = ip_addr;
  url.port = "8080";

  console.log(url.toString());
  qrcode.generate(url.toString(), { small: true });
  console.log();
};

const main = () => {
  for (const addr of getIPAddrs()) {
    printQR(addr);
  }

  http.createServer(httpHandler).listen(8080);
  console.log("Server running at http://localhost:8080/");
};
main();
