import { MongoClient } from "mongodb";
import { logging, runtimes } from "bytehappens";
import { storageMongoDb } from "bytehappens-storage-mongodb";
import { loggingWinston } from "bytehappens-logging-winston";

import { CronApplication } from "common/scheduling/cron";

import { CreateMongoDbLogUserTask } from "./tasks/createmongodbusertask";
import { CleanLogsTask } from "./tasks/cleanlogstask";

export class RuntimeFactory<
  TLog extends logging.ILog,
  TLoggerFactory extends loggingWinston.console.WinstonConsoleLoggerFactory<TLog>
> implements runtimes.core.IRuntimeFactory<runtimes.tasks.ITask> {
  private LoadWinstonConsoleTransportConfiguration(): loggingWinston.console.IWinstonConsoleTransportConfiguration {
    let level: string = process.env.LOGGING_CONSOLE_LEVEL;
    return new loggingWinston.console.WinstonConsoleTransportConfiguration(level);
  }

  private GetCheckMongoDbAvailabilityTask(
    startupLoggerFactory: TLoggerFactory,
    connection: storageMongoDb.core.IMongoDbConnection,
    user: storageMongoDb.core.IMongoDbUser
  ): runtimes.tasks.ITask {
    let response: runtimes.tasks.ITask = new runtimes.tasks.LambdaTask(
      async () => {
        //  SCK: If we can create client, then it is available
        let client: MongoClient = await storageMongoDb.core.CreateMongoDbClientAsync(connection, user);
        return true;
      },
      "CheckMongoDbAvailabilityTask",
      startupLoggerFactory
    );

    response = new runtimes.tasks.RetriableTask(response, 5, 5000, "RetryCheckMongoDbAvailabilityTask", startupLoggerFactory);

    return response;
  }

  private GetCreateMongoDbLogUserTask(
    startupLoggerFactory: TLoggerFactory,
    connection: storageMongoDb.core.IMongoDbConnection,
    adminUser: storageMongoDb.core.IMongoDbUser,
    loggingUser: storageMongoDb.core.IMongoDbUser
  ): runtimes.tasks.ITask {
    let response: runtimes.tasks.ITask = new CreateMongoDbLogUserTask(
      connection,
      adminUser,
      loggingUser,
      "CreateMongoDbLogUser",
      startupLoggerFactory
    );

    response = new runtimes.tasks.RetriableTask(response, 2, 10000, "RetryCreateMongoDbLogUser", startupLoggerFactory);

    return response;
  }

  private GetCleanLogsApplicationTask(
    loggerFactory: TLoggerFactory,
    startupLoggerFactory: TLoggerFactory,
    connection: storageMongoDb.core.IMongoDbConnection,
    user: storageMongoDb.core.IMongoDbUser
  ): runtimes.tasks.ITask {
    let applicationName: string = process.env.CLEANLOGS_APP_NAME;
    let cronSchedule: string = process.env.CLEANLOGS_CRON_SCHEDULE;
    let daysToKeep: number = parseInt(process.env.CLEANLOGS_DAYSTOKEEP);

    let scheduledTask: runtimes.tasks.ITask = new CleanLogsTask(connection, user, daysToKeep, applicationName, loggerFactory);

    let application: runtimes.applications.IApplication = new CronApplication(
      scheduledTask,
      cronSchedule,
      applicationName,
      loggerFactory
    );

    let response: runtimes.tasks.ITask = new runtimes.tasks.StartApplicationTask(
      application,
      `Start${applicationName}`,
      startupLoggerFactory
    );

    return response;
  }

  public async CreateRuntimeAsync(): Promise<runtimes.tasks.ITask> {
    let response: runtimes.tasks.ITask;

    let consoleTransportConfiguration: loggingWinston.console.IWinstonConsoleTransportConfiguration = this.LoadWinstonConsoleTransportConfiguration();
    let startupLoggerFactory: TLoggerFactory = <TLoggerFactory>(
      new loggingWinston.console.WinstonConsoleLoggerFactory<TLog>(
        consoleTransportConfiguration.level,
        consoleTransportConfiguration
      )
    );

    let useMongoDb: boolean = process.env.LOGGING_MONGODB_USE === "true";
    if (useMongoDb) {
      let host: string = process.env.LOGGING_MONGODB_HOST;
      let port: number = parseInt(process.env.LOGGING_MONGODB_PORT);
      let connection: storageMongoDb.core.IMongoDbConnection = {
        host: host,
        port: port
      };

      let adminUsername: string = process.env.LOGGING_MONGODB_ADMIN_USERNAME;
      let adminPassword: string = process.env.LOGGING_MONGODB_ADMIN_PASSWORD;
      let adminUser: storageMongoDb.core.IMongoDbUser = {
        username: adminUsername,
        password: adminPassword
      };

      let loggingUsername: string = process.env.LOGGING_MONGODB_USERNAME;
      let loggingPassword: string = process.env.LOGGING_MONGODB_PASSWORD;
      let loggingDatabaseName: string = process.env.LOGGING_MONGODB_DATABASE;
      let loggingUser: storageMongoDb.core.IMongoDbUser = {
        username: loggingUsername,
        password: loggingPassword,
        databaseName: loggingDatabaseName
      };

      let checkMongoDbAvailabilityTask: runtimes.tasks.ITask = this.GetCheckMongoDbAvailabilityTask(
        startupLoggerFactory,
        connection,
        adminUser
      );

      let createMongoDbLogUserTask: runtimes.tasks.ITask = this.GetCreateMongoDbLogUserTask(
        startupLoggerFactory,
        connection,
        adminUser,
        loggingUser
      );

      response = new runtimes.tasks.TaskChain(
        checkMongoDbAvailabilityTask,
        createMongoDbLogUserTask,
        new runtimes.tasks.LambdaTask(
          async () => {
            return true;
          },
          "OnFailureTask",
          startupLoggerFactory
        ),
        "TaskChain",
        startupLoggerFactory
      );

      let applicationTask: runtimes.tasks.ITask = this.GetCleanLogsApplicationTask(
        startupLoggerFactory,
        startupLoggerFactory,
        connection,
        loggingUser
      );

      response = new runtimes.tasks.TaskChain(
        response,
        applicationTask,
        new runtimes.tasks.LambdaTask(
          async () => {
            return true;
          },
          "OnFailureTask",
          startupLoggerFactory
        ),
        "TaskChain",
        startupLoggerFactory
      );
    }

    return response;
  }
}
