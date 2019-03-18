import { logging, runtimes } from "bytehappens";
import { storageMongoDb } from "bytehappens-storage-mongodb";
import { loggingWinston } from "bytehappens-logging-winston";

import { CronApplication } from "common/scheduling/cron";

import { CreateMongoDbLogUserTask } from "../tasks/createmongodbusertask";
import { CleanLogsTask } from "../tasks/cleanlogstask";

export function GetAwaitMongoDbAvailabilityTask<
  TLog extends logging.ILog,
  TStartupLoggerFactory extends loggingWinston.console.WinstonConsoleLoggerFactory<TLog>
>(
  connection: storageMongoDb.core.IMongoDbConnection,
  user: storageMongoDb.core.IMongoDbUser,
  maxAttempts: number,
  delayInMs: number,
  startupLoggerFactory: TStartupLoggerFactory
): runtimes.tasks.ITask {
  return new storageMongoDb.core.AwaitMongoDbAvailabilityTask(connection, user, maxAttempts, delayInMs, startupLoggerFactory);
}

export function GetCreateMongoDbLogUserTask<
  TLog extends logging.ILog,
  TStartupLoggerFactory extends loggingWinston.console.WinstonConsoleLoggerFactory<TLog>
>(
  connection: storageMongoDb.core.IMongoDbConnection,
  adminUser: storageMongoDb.core.IMongoDbUser,
  loggingUser: storageMongoDb.core.IMongoDbUser,
  startupLoggerFactory: TStartupLoggerFactory
): runtimes.tasks.ITask {
  let response: runtimes.tasks.ITask = new CreateMongoDbLogUserTask(
    connection,
    adminUser,
    loggingUser,
    "CreateMongoDbLogUser",
    startupLoggerFactory
  );

  return response;
}

export function GetCleanLogsApplicationTask<
  TLog extends logging.ILog,
  TLogger extends loggingWinston.core.WinstonLogger<TLog>,
  TRuntimeLoggerFactory extends loggingWinston.core.WinstonLoggerFactory<TLog, TLogger>,
  TStartupLoggerFactory extends loggingWinston.console.WinstonConsoleLoggerFactory<TLog>
>(
  connection: storageMongoDb.core.IMongoDbConnection,
  user: storageMongoDb.core.IMongoDbUser,
  runtimeLoggerFactory: TRuntimeLoggerFactory,
  startupLoggerFactory: TStartupLoggerFactory
): runtimes.tasks.ITask {
  let applicationName: string = process.env.CLEANLOGS_APP_NAME;
  let cronSchedule: string = process.env.CLEANLOGS_CRON_SCHEDULE;
  let daysToKeep: number = parseInt(process.env.CLEANLOGS_DAYSTOKEEP);

  let scheduledTask: runtimes.tasks.ITask = new CleanLogsTask(
    connection,
    user,
    daysToKeep,
    applicationName,
    runtimeLoggerFactory
  );

  let application: runtimes.applications.IApplication = new CronApplication(
    scheduledTask,
    cronSchedule,
    applicationName,
    runtimeLoggerFactory
  );

  let response: runtimes.tasks.ITask = new runtimes.tasks.StartApplicationTask(
    application,
    `Start${applicationName}`,
    startupLoggerFactory
  );

  return response;
}
