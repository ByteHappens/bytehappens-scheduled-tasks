import { logging, runtimes } from "bytehappens";
import { storageMongoDb } from "bytehappens-storage-mongodb";
import { loggingWinston } from "bytehappens-logging-winston";

import * as LoggerHelper from "../helpers/loggerhelper";
import * as TaskHelper from "../helpers/taskhelper";

export class RuntimeFactory<
  TLog extends logging.ILog,
  TLogger extends loggingWinston.core.WinstonLogger<TLog>,
  TRuntimeLoggerFactory extends loggingWinston.core.WinstonLoggerFactory<TLog, TLogger>,
  TStartupLoggerFactory extends loggingWinston.console.WinstonConsoleLoggerFactory<TLog>
> implements runtimes.core.IRuntimeFactory<runtimes.tasks.ITask> {
  public async CreateRuntimeAsync(): Promise<runtimes.tasks.ITask> {
    let response: runtimes.tasks.ITask;

    let startupLoggerFactory: TStartupLoggerFactory = LoggerHelper.GetStartupLoggerFactory();
    let runtimeLoggerFactory: TRuntimeLoggerFactory = await LoggerHelper.GetRuntimeLoggerFactoryAsync(startupLoggerFactory);

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

      let checkMongoDbAvailabilityTask: runtimes.tasks.ITask = TaskHelper.GetCheckMongoDbAvailabilityTask(
        startupLoggerFactory,
        connection,
        adminUser
      );

      let createMongoDbLogUserTask: runtimes.tasks.ITask = TaskHelper.GetCreateMongoDbLogUserTask(
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

      let applicationTask: runtimes.tasks.ITask = TaskHelper.GetCleanLogsApplicationTask(
        runtimeLoggerFactory,
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
