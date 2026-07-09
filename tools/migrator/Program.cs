using DbUp;
using DbUp.Engine;
using DotNetEnv;
using Npgsql;

try
{
    var repositoryRoot = Directory.GetCurrentDirectory();
    var envPath = Path.Combine(repositoryRoot, ".env");

    if (!File.Exists(envPath))
    {
        throw new FileNotFoundException(
            $"Environment file was not found: {envPath}. Copy .env.example to .env and configure it.");
    }

    Env.NoClobber().Load(envPath);

    var connectionString = BuildOwnerConnectionString();

    var migrationsPath = Path.GetFullPath(
        Path.Combine(repositoryRoot, "database", "migrations"));

    if (!Directory.Exists(migrationsPath))
    {
        throw new DirectoryNotFoundException(
            $"Migration directory was not found: {migrationsPath}. Run the migrator from the repository root.");
    }

    var scripts = LoadScripts(migrationsPath);

    if (scripts.Count == 0)
    {
        throw new InvalidOperationException($"No SQL migration files were found in {migrationsPath}.");
    }

    Console.WriteLine("Internal Apps Platform database migrator");
    Console.WriteLine($"Migration directory: {migrationsPath}");
    Console.WriteLine($"Discovered migrations: {scripts.Count}");
    Console.WriteLine("Connecting with owner settings loaded from .env. Credentials will not be displayed.");

    var upgrader = DeployChanges.To
        .PostgresqlDatabase(connectionString)
        .WithScripts(scripts)
        .LogToConsole()
        .Build();

    var result = upgrader.PerformUpgrade();

    if (!result.Successful)
    {
        Console.Error.WriteLine("Database migration failed.");
        Console.Error.WriteLine(result.Error.Message);
        return 1;
    }

    Console.WriteLine("Database migrations completed successfully.");
    return 0;
}
catch (Exception exception)
{
    Console.Error.WriteLine("Database migration failed.");
    Console.Error.WriteLine(exception.Message);
    return 1;
}

static string GetRequiredEnvironmentVariable(string name)
{
    var value = Environment.GetEnvironmentVariable(name);

    if (string.IsNullOrWhiteSpace(value))
    {
        throw new InvalidOperationException($"Required environment variable {name} is not set.");
    }

    return value;
}

static string BuildOwnerConnectionString()
{
    var host = GetRequiredEnvironmentVariable("DB_HOST");
    var portValue = GetRequiredEnvironmentVariable("DB_PORT");
    var database = GetRequiredEnvironmentVariable("DB_NAME");
    var username = GetRequiredEnvironmentVariable("DB_OWNER_USER");
    var password = GetRequiredEnvironmentVariable("DB_OWNER_PASSWORD");
    var sslModeValue = GetRequiredEnvironmentVariable("DB_SSL_MODE");
    var trustServerCertificateValue =
        GetRequiredEnvironmentVariable("DB_TRUST_SERVER_CERTIFICATE");

    RejectPlaceholderPassword("DB_OWNER_PASSWORD", password, "change_me_locally");

    if (!int.TryParse(portValue, out var port) || port is < 1 or > 65535)
    {
        throw new InvalidOperationException(
            "DB_PORT must be an integer between 1 and 65535.");
    }

    if (!Enum.TryParse<SslMode>(sslModeValue, ignoreCase: true, out var sslMode) ||
        !Enum.IsDefined(sslMode))
    {
        throw new InvalidOperationException(
            "DB_SSL_MODE is invalid. Use a value supported by Npgsql, such as Require, VerifyCA, or VerifyFull.");
    }

    if (!bool.TryParse(trustServerCertificateValue, out var trustServerCertificate))
    {
        throw new InvalidOperationException(
            "DB_TRUST_SERVER_CERTIFICATE must be true or false.");
    }

    var builder = new NpgsqlConnectionStringBuilder
    {
        Host = host,
        Port = port,
        Database = database,
        Username = username,
        Password = password,
        SslMode = sslMode,
        ApplicationName = "InternalApps.Migrator",
        IncludeErrorDetail = false,
        PersistSecurityInfo = false
    };

    builder["Trust Server Certificate"] = trustServerCertificate;

    return builder.ConnectionString;
}

static void RejectPlaceholderPassword(string name, string value, string placeholder)
{
    if (string.Equals(value, placeholder, StringComparison.Ordinal))
    {
        throw new InvalidOperationException(
            $"{name} still contains the example placeholder. Set a private password in .env.");
    }
}

static IReadOnlyList<SqlScript> LoadScripts(string migrationsPath)
{
    var scripts = new List<SqlScript>();

    foreach (var path in Directory
        .EnumerateFiles(migrationsPath, "*.sql", SearchOption.TopDirectoryOnly)
        .OrderBy(path => Path.GetFileName(path), StringComparer.Ordinal))
    {
        var contents = File.ReadAllText(path);
        scripts.Add(new SqlScript(Path.GetFileName(path), contents));
    }

    return scripts;
}
