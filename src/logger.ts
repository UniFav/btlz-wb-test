import fs from "fs";
import path from "path";
import env from "#config/env/env.js";
import pinoPkg from "pino";

const pino = pinoPkg.default;

const logDir = "logs";
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir);
}

const streams: any[] = [];

const prettyOptions = {
  colorize: false,
  translateTime: "yyyy-mm-dd HH:MM:ss",
  ignore: "pid,hostname",
  singleLine: false,
};

streams.push({
  level: "info",
  stream: pino.transport({
    target: "pino-pretty",
    options: {
      ...prettyOptions,
      colorize: true,
    },
  }),
});

if (env.NODE_ENV === "production") {
  streams.push({
    level: "info",
    stream: pino.transport({
      target: "pino-pretty",
      options: {
        ...prettyOptions,
        destination: path.join(logDir, "app.log"),
      },
    }),
  });

  streams.push({
    level: "error",
    stream: pino.transport({
      target: "pino-pretty",
      options: {
        ...prettyOptions,
        destination: path.join(logDir, "error.log"),
      },
    }),
  });
}

export const logger = pino(
  {
    level: "info",
  },
  pino.multistream(streams)
);