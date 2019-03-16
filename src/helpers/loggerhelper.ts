import { logging } from "bytehappens";
import { loggingWinston } from "bytehappens-logging-winston";

let LoadWinstonConsoleTransportConfiguration = function(): loggingWinston.console.IWinstonConsoleTransportConfiguration {
  let level: string = process.env.LOGGING_CONSOLE_LEVEL;
  return new loggingWinston.console.WinstonConsoleTransportConfiguration(level);
};

let LoadWinstonTelegramTransportConfiguration = function(): loggingWinston.telegram.IWinstonTelegramTransportConfiguration {
  let response: loggingWinston.telegram.IWinstonTelegramTransportConfiguration = undefined;

  let useTelegram: boolean = process.env.LOGGING_TELEGRAM_USE === "true";
  if (useTelegram) {
    let level: string = process.env.LOGGING_TELEGRAM_LEVEL;
    let token: string = process.env.LOGGING_TELEGRAM_TOKEN;
    let chatId: number = parseInt(process.env.LOGGING_TELEGRAM_CHAT_ID);
    let disableNotification: boolean = process.env.LOGGING_TELEGRAM_DISABLE_NOTIFICATION === "true";

    response = new loggingWinston.telegram.WinstonTelegramTransportConfiguration(token, chatId, disableNotification, level);
  }

  return response;
};

let LoadWinstonMongoDbTransportConfiguration = function(): loggingWinston.mongodb.IWinstonMongoDbTransportConfiguration {
  let response: loggingWinston.mongodb.IWinstonMongoDbTransportConfiguration = undefined;

  let useMongoDb: boolean = process.env.LOGGING_MONGODB_USE === "true";
  if (useMongoDb) {
    let level: string = process.env.LOGGING_MONGODB_LEVEL;
    let host: string = process.env.LOGGING_MONGODB_HOST;
    let port: number = parseInt(process.env.LOGGING_MONGODB_PORT);
    let username: string = process.env.LOGGING_MONGODB_USERNAME;
    let password: string = process.env.LOGGING_MONGODB_PASSWORD;
    let databaseName: string = process.env.LOGGING_MONGODB_DATABASE;
    let collection: string = process.env.CLEANLOGS_APP_NAME;

    response = new loggingWinston.mongodb.WinstonMongoDbTransportConfiguration(
      {
        host: host,
        port: port
      },
      {
        username: username,
        password: password,
        databaseName: databaseName
      },
      collection,
      level
    );
  }

  return response;
};

let AddTransportConfiguration = function<TLog extends logging.ILog>(
  current: loggingWinston.core.IWinstonTransportConfiguration,
  existing: loggingWinston.core.IWinstonTransportConfiguration[],
  startupLogger: loggingWinston.core.WinstonLogger<TLog>
): void {
  if (current) {
    try {
      current.Validate();
      existing.push(current);
    } catch (error) {
      startupLogger.Log(<TLog>{
        level: "error",
        message: "Failed to load add transport configuration",
        meta: { error }
      });
    }
  }
};

export function GetStartupLoggerFactory<
  TLog extends logging.ILog,
  TStartupLoggerFactory extends loggingWinston.console.WinstonConsoleLoggerFactory<TLog>
>(): TStartupLoggerFactory {
  let consoleTransportConfiguration: loggingWinston.console.IWinstonConsoleTransportConfiguration = LoadWinstonConsoleTransportConfiguration();
  return <TStartupLoggerFactory>(
    new loggingWinston.console.WinstonConsoleLoggerFactory<TLog>(
      consoleTransportConfiguration.level,
      consoleTransportConfiguration
    )
  );
}

export async function GetRuntimeLoggerFactoryAsync<
  TLog extends logging.ILog,
  TLogger extends loggingWinston.core.WinstonLogger<TLog>,
  TRuntimeLoggerFactory extends loggingWinston.core.WinstonLoggerFactory<TLog, TLogger>,
  TStartupLoggerFactory extends loggingWinston.console.WinstonConsoleLoggerFactory<TLog>
>(startupLoggerFactory: TStartupLoggerFactory): Promise<TRuntimeLoggerFactory> {
  let startupLogger: loggingWinston.core.WinstonLogger<TLog> = await startupLoggerFactory.CreateLoggerAsync();
  let transportConfigurations: loggingWinston.core.IWinstonTransportConfiguration[] = [];

  let consoleTransportConfiguration: loggingWinston.console.IWinstonConsoleTransportConfiguration = LoadWinstonConsoleTransportConfiguration();
  AddTransportConfiguration(consoleTransportConfiguration, transportConfigurations, startupLogger);

  let telegramTransportConfiguration: loggingWinston.telegram.IWinstonTelegramTransportConfiguration = LoadWinstonTelegramTransportConfiguration();
  AddTransportConfiguration(telegramTransportConfiguration, transportConfigurations, startupLogger);

  let mongoDbTransportConfiguration: loggingWinston.mongodb.IWinstonMongoDbTransportConfiguration = LoadWinstonMongoDbTransportConfiguration();
  AddTransportConfiguration(mongoDbTransportConfiguration, transportConfigurations, startupLogger);

  return <TRuntimeLoggerFactory>(
    new loggingWinston.core.WinstonLoggerFactory(consoleTransportConfiguration.level, transportConfigurations)
  );
}
