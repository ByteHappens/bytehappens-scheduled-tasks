import { logging, runtimes } from "bytehappens";
import { storageMongoDb } from "bytehappens-storage-mongodb";
import { loggingWinston } from "bytehappens-logging-winston";

import { CreateMongoDbLogUserTask } from "./tasks/createmongodbusertask";

export class RuntimeFactory<
  TLog extends logging.ILog,
  TLogger extends loggingWinston.core.WinstonLogger<TLog>,
  TLoggerFactory extends loggingWinston.core.WinstonLoggerFactory<TLog, TLogger>,
  TSetupLoggerFactory extends loggingWinston.console.WinstonConsoleLoggerFactory<TLog>
> implements runtimes.core.IRuntimeFactory<runtimes.tasks.ITask> {
  private LoadWinstonConsoleTransportConfiguration(): loggingWinston.console.IWinstonConsoleTransportConfiguration {
    let level: string = process.env.LOGGING_CONSOLE_LEVEL;
    return new loggingWinston.console.WinstonConsoleTransportConfiguration(level);
  }

  private LoadWinstonTelegramTransportConfiguration(): loggingWinston.telegram.IWinstonTelegramTransportConfiguration {
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
  }

  private LoadWinstonMongoDbTransportConfiguration(): loggingWinston.mongodb.IWinstonMongoDbTransportConfiguration {
    let response: loggingWinston.mongodb.IWinstonMongoDbTransportConfiguration = undefined;

    let useMongoDb: boolean = process.env.LOGGING_MONGODB_USE === "true";
    if (useMongoDb) {
      let level: string = process.env.LOGGING_MONGODB_LEVEL;
      let host: string = process.env.LOGGING_MONGODB_HOST;
      let port: number = parseInt(process.env.LOGGING_MONGODB_PORT);
      let username: string = process.env.LOGGING_MONGODB_USERNAME;
      let password: string = process.env.LOGGING_MONGODB_PASSWORD;
      let databaseName: string = process.env.LOGGING_MONGODB_DATABASE;
      let collection: string = process.env.LOGGING_MONGODB_COLLECTION;

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
  }

  private AddTransportConfiguration(
    current: loggingWinston.core.IWinstonTransportConfiguration,
    existing: loggingWinston.core.IWinstonTransportConfiguration[],
    setupLogger: loggingWinston.core.WinstonLogger<TLog>
  ) {
    if (current) {
      try {
        current.Validate();
        existing.push(current);
      } catch (error) {
        setupLogger.Log(<TLog>{
          level: "error",
          message: "Failed to load add transport configuration",
          meta: { error }
        });
        //  EBU: How to log ?
      }
    }
  }

  private async GetLoggerFactoryAsync(setupLoggerFactory: TSetupLoggerFactory): Promise<TLoggerFactory> {
    let setupLogger: loggingWinston.core.WinstonLogger<TLog> = await setupLoggerFactory.CreateLoggerAsync();
    let transportConfigurations: loggingWinston.core.IWinstonTransportConfiguration[] = [];

    let consoleTransportConfiguration: loggingWinston.console.IWinstonConsoleTransportConfiguration = this.LoadWinstonConsoleTransportConfiguration();
    this.AddTransportConfiguration(consoleTransportConfiguration, transportConfigurations, setupLogger);

    let telegramTransportConfiguration: loggingWinston.telegram.IWinstonTelegramTransportConfiguration = this.LoadWinstonTelegramTransportConfiguration();
    this.AddTransportConfiguration(telegramTransportConfiguration, transportConfigurations, setupLogger);

    let mongoDbTransportConfiguration: loggingWinston.mongodb.IWinstonMongoDbTransportConfiguration = this.LoadWinstonMongoDbTransportConfiguration();
    this.AddTransportConfiguration(mongoDbTransportConfiguration, transportConfigurations, setupLogger);

    return <TLoggerFactory>(
      new loggingWinston.core.WinstonLoggerFactory(consoleTransportConfiguration.level, transportConfigurations)
    );
  }

  private GetCreateMongoDbLogUserTask(setupLoggerFactory: TSetupLoggerFactory): runtimes.tasks.ITask {
    let response: runtimes.tasks.ITask;

    let useMongoDb: boolean = process.env.LOGGING_MONGODB_USE === "true";
    console.log(useMongoDb);
    if (useMongoDb) {
      let host: string = process.env.LOGGING_MONGODB_HOST;
      let port: number = parseInt(process.env.LOGGING_MONGODB_PORT);
      let connection: storageMongoDb.core.IMongoDbConnection = {
        host: host,
        port: port
      };

      let username: string = process.env.LOGGING_MONGODB_ADMIN_USERNAME;
      let password: string = process.env.LOGGING_MONGODB_ADMIN_PASSWORD;
      let user: storageMongoDb.core.IMongoDbUser = {
        username: username,
        password: password
      };

      let newUsername: string = process.env.LOGGING_MONGODB_USERNAME;
      let newPassword: string = process.env.LOGGING_MONGODB_PASSWORD;
      let databaseName: string = process.env.LOGGING_MONGODB_DATABASE;
      let newUser: storageMongoDb.core.IMongoDbUser = {
        username: newUsername,
        password: newPassword,
        databaseName: databaseName
      };

      response = new CreateMongoDbLogUserTask(connection, user, newUser, "CreateMongoDbLogUser", setupLoggerFactory);
      response = new runtimes.tasks.RetriableTask(response, 2, 10000, "RetryCreateMongoDbLogUser", setupLoggerFactory);
    }

    return response;
  }

  public async CreateRuntimeAsync(): Promise<runtimes.tasks.ITask> {
    let response: runtimes.tasks.ITask;

    let consoleTransportConfiguration: loggingWinston.console.IWinstonConsoleTransportConfiguration = this.LoadWinstonConsoleTransportConfiguration();
    let setupLoggerFactory: TSetupLoggerFactory = <TSetupLoggerFactory>(
      new loggingWinston.console.WinstonConsoleLoggerFactory<TLog>(
        consoleTransportConfiguration.level,
        consoleTransportConfiguration
      )
    );

    response = this.GetCreateMongoDbLogUserTask(setupLoggerFactory);
    return response;
  }
}
