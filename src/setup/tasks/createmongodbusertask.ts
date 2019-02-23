import { MongoClient, Db, DbAddUserOptions } from "mongodb";
import { logging, runtimes } from "bytehappens";
import { storageMongoDb } from "bytehappens-storage-mongodb";

export class CreateMongoDbLogUserTask<
  TLog extends logging.ILog,
  TLogger extends logging.ILogger<TLog>,
  TLoggerFactory extends logging.ILoggerFactory<TLog, TLogger>
> extends runtimes.tasks.BaseTask<TLog, TLogger, TLoggerFactory> {
  private readonly _mongoDbConnection: storageMongoDb.core.IMongoDbConnection;
  private readonly _mongoDbUser: storageMongoDb.core.IMongoDbUser;
  private readonly _mongoDbNewUser: storageMongoDb.core.IMongoDbUser;

  public constructor(
    mongoDbConnection: storageMongoDb.core.IMongoDbConnection,
    mongoDbUser: storageMongoDb.core.IMongoDbUser,
    newMongoDbUser: storageMongoDb.core.IMongoDbUser,
    taskName: string,
    loggerFactory: TLoggerFactory
  ) {
    super(taskName, loggerFactory);

    this._mongoDbConnection = mongoDbConnection;
    this._mongoDbUser = mongoDbUser;
    this._mongoDbNewUser = newMongoDbUser;
  }

  private async AddNewUserAsync(
    mongoDbConfiguration: storageMongoDb.core.IMongoDbConnection,
    mongoDbUser: storageMongoDb.core.IMongoDbUser,
    newMongoDbUser: storageMongoDb.core.IMongoDbUser
  ): Promise<boolean> {
    let client: MongoClient = await storageMongoDb.core.CreateMongoDbClientAsync(mongoDbConfiguration, mongoDbUser);

    let databaseName: string = newMongoDbUser.databaseName;
    let options: DbAddUserOptions = {
      roles: [
        {
          role: "readWrite",
          db: newMongoDbUser.databaseName
        }
      ]
    };

    let db: Db = client.db(databaseName);
    await db.addUser(newMongoDbUser.username, newMongoDbUser.password, options);

    return true;
  }

  protected async ExecuteInternalAsync(): Promise<boolean> {
    let response: boolean = false;

    try {
      response = await this.AddNewUserAsync(this._mongoDbConnection, this._mongoDbUser, this._mongoDbNewUser);

      this._logger.Log(<TLog>{
        level: "verbose",
        message: "Created User",
        meta: {
          connection: this._mongoDbConnection,
          user: this._mongoDbUser,
          newUser: this._mongoDbNewUser
        }
      });

      response = true;
    } catch (error) {
      if (error.name === "MongoError" && error.codeName === "DuplicateKey") {
        this._logger.Log(<TLog>{
          level: "verbose",
          message: "User already created",
          meta: {
            connection: this._mongoDbConnection,
            user: this._mongoDbUser,
            newUser: this._mongoDbNewUser
          }
        });
      } else if (error.name === "MongoNetworkError") {
        this._logger.Log(<TLog>{
          level: "error",
          message: "Failed to create user: Server unreachable",
          meta: {
            connection: this._mongoDbConnection,
            user: this._mongoDbUser,
            newUser: this._mongoDbNewUser
          }
        });
      } else {
        this._logger.Log(<TLog>{
          level: "error",
          message: "Failed to create user",
          meta: {
            connection: this._mongoDbConnection,
            user: this._mongoDbUser,
            newUser: this._mongoDbNewUser
          }
        });
      }
    }

    return response;
  }
}
