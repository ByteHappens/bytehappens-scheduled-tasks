import { MongoClient, Db, Collection, DeleteWriteOpResultObject } from "mongodb";
import * as moment from "moment";
import { logging, runtimes } from "bytehappens";
import { storageMongoDb } from "bytehappens-storage-mongodb";

export class CleanLogsTask<
  TLog extends logging.ILog,
  TLogger extends logging.ILogger<TLog>,
  TLoggerFactory extends logging.ILoggerFactory<TLog, TLogger>
> extends runtimes.tasks.BaseTask<TLog, TLogger, TLoggerFactory> {
  private readonly _mongoDbConnection: storageMongoDb.core.IMongoDbConnection;
  private readonly _mongoDbUser: storageMongoDb.core.IMongoDbUser;
  private readonly _daysToKeep: number;

  public constructor(
    mongoDbConnection: storageMongoDb.core.IMongoDbConnection,
    mongoDbUser: storageMongoDb.core.IMongoDbUser,
    daysToKeep: number,
    taskName: string,
    loggerFactory: TLoggerFactory
  ) {
    super(taskName, loggerFactory);

    this._mongoDbConnection = mongoDbConnection;
    this._mongoDbUser = mongoDbUser;
    this._daysToKeep = daysToKeep;
  }

  protected async ExecuteInternalAsync(): Promise<boolean> {
    let response: boolean = false;

    this._logger.Log(<TLog>{
      level: "verbose",
      message: `Attempting to clean logs over last ${this._daysToKeep} days`
    });

    let client: MongoClient = await storageMongoDb.core.CreateMongoDbClientAsync(this._mongoDbConnection, this._mongoDbUser);
    let db: Db = client.db();

    let collections: Collection<any>[] = await db.collections();

    await Promise.all(
      collections.map(async (collection: Collection) => {
        this._logger.Log(<TLog>{
          level: "verbose",
          message: `Attempting to clean collection ${collection.collectionName}`
        });

        try {
          let result: DeleteWriteOpResultObject = await collection.deleteMany({
            timestamp: {
              $lte: moment()
                .utc()
                .startOf("day")
                .subtract(this._daysToKeep, "days")
                .toDate()
            }
          });

          this._logger.Log(<TLog>{
            level: "verbose",
            message: `Deleted ${result.deletedCount} from ${collection.collectionName}`
          });
        } catch (error) {
          this._logger.Log(<TLog>{
            level: "error",
            message: "Failed to clean logs",
            meta: {
              connection: this._mongoDbConnection,
              user: this._mongoDbUser,
              collection: collection.collectionName
            }
          });
        }
      })
    );

    client.close();

    return response;
  }
}
