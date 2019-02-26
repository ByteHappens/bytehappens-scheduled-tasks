import { MongoClient } from "mongodb";
import { logging, runtimes } from "bytehappens";
import { storageMongoDb } from "bytehappens-storage-mongodb";
import { loggingWinston } from "bytehappens-logging-winston";

import { CreateMongoDbLogUserTask } from "./tasks/createmongodbusertask";

export class RuntimeFactory<
  TLog extends logging.ILog,
  TLoggerFactory extends loggingWinston.console.WinstonConsoleLoggerFactory<TLog>
> implements runtimes.core.IRuntimeFactory<runtimes.tasks.ITask> {
  private LoadWinstonConsoleTransportConfiguration(): loggingWinston.console.IWinstonConsoleTransportConfiguration {
    let level: string = process.env.LOGGING_CONSOLE_LEVEL;
    return new loggingWinston.console.WinstonConsoleTransportConfiguration(level);
  }

  private GetCreateMongoDbLogUserTask(setupLoggerFactory: TLoggerFactory): runtimes.tasks.ITask {
    let response: runtimes.tasks.ITask;

    let useMongoDb: boolean = process.env.LOGGING_MONGODB_USE === "true";
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

      let checkMongoDbAvailabilityTask: runtimes.tasks.ITask = new runtimes.tasks.LambdaTask(
        async () => {
          //  SCK: If we can create client, then it is available
          let client: MongoClient = await storageMongoDb.core.CreateMongoDbClientAsync(connection, user);
          return true;
        },
        "CheckMongoDbAvailabilityTask",
        setupLoggerFactory
      );

      let retryCheckMongoDbAvailabilityTask: runtimes.tasks.ITask = new runtimes.tasks.RetriableTask(
        checkMongoDbAvailabilityTask,
        5,
        5000,
        "RetryCheckMongoDbAvailabilityTask",
        setupLoggerFactory
      );

      let createMongoDbLogUserTask: runtimes.tasks.ITask = new CreateMongoDbLogUserTask(
        connection,
        user,
        newUser,
        "CreateMongoDbLogUser",
        setupLoggerFactory
      );

      let retryCreateMongoDbLogUserTask: runtimes.tasks.ITask = new runtimes.tasks.RetriableTask(
        createMongoDbLogUserTask,
        2,
        10000,
        "RetryCreateMongoDbLogUser",
        setupLoggerFactory
      );

      response = new runtimes.tasks.TaskChain(
        retryCheckMongoDbAvailabilityTask,
        retryCreateMongoDbLogUserTask,
        new runtimes.tasks.LambdaTask(
          async () => {
            return true;
          },
          "OnFailureTask",
          setupLoggerFactory
        ),
        "TaskChain",
        setupLoggerFactory
      );
    }

    return response;
  }

  public async CreateRuntimeAsync(): Promise<runtimes.tasks.ITask> {
    let response: runtimes.tasks.ITask;

    let consoleTransportConfiguration: loggingWinston.console.IWinstonConsoleTransportConfiguration = this.LoadWinstonConsoleTransportConfiguration();
    let setupLoggerFactory: TLoggerFactory = <TLoggerFactory>(
      new loggingWinston.console.WinstonConsoleLoggerFactory<TLog>(
        consoleTransportConfiguration.level,
        consoleTransportConfiguration
      )
    );

    response = this.GetCreateMongoDbLogUserTask(setupLoggerFactory);
    return response;
  }
}
