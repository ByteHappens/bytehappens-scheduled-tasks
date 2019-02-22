import { CronJob } from "cron";
import { logging, runtimes } from "bytehappens";

export class CronApplication<
  TLog extends logging.ILog,
  TLogger extends logging.ILogger<TLog>,
  TLoggerFactory extends logging.ILoggerFactory<TLog, TLogger>
> extends runtimes.applications.BaseApplication<TLog, TLogger, TLoggerFactory> {
  private readonly _cronTime: string;
  private readonly _task: runtimes.tasks.ITask;
  private readonly _job: CronJob;

  public constructor(task: runtimes.tasks.ITask, cronTime: string, applicationName: string, loggerFactory: TLoggerFactory) {
    super(applicationName, loggerFactory);

    this._cronTime = cronTime;
    this._task = task;
    this._job = new CronJob(this._cronTime, async () => await this._task.RunAsync());
  }

  protected async StartInternalAsync(): Promise<void> {
    this._logger.Log(<TLog>{
      level: "verbose",
      message: `Starting ${this._applicationName} application with cron schedule ${this._cronTime}`
    });

    this._job.start();
  }

  protected async StopInternalAsync(): Promise<boolean> {
    this._job.stop();
    
    return true;
  }
}
