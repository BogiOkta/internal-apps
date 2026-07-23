using DbUp;
using DbUp.Engine;
using DotNetEnv;
using Npgsql;

const string AdminPasswordHashToken = "__ADMIN_PASSWORD_HASH_SQL_EXPRESSION__";

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
    var adminInitialPassword = GetRequiredEnvironmentVariable("ADMIN_INITIAL_PASSWORD");
    RejectPlaceholderPassword(
        "ADMIN_INITIAL_PASSWORD",
        adminInitialPassword,
        "change_me_before_migration");
    var adminPasswordHash = BCrypt.Net.BCrypt.HashPassword(adminInitialPassword, workFactor: 12);

    var migrationsPath = Path.GetFullPath(
        Path.Combine(repositoryRoot, "database", "migrations"));

    if (!Directory.Exists(migrationsPath))
    {
        throw new DirectoryNotFoundException(
            $"Migration directory was not found: {migrationsPath}. Run the migrator from the repository root.");
    }

    var scripts = LoadScripts(migrationsPath, adminPasswordHash);

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

static IReadOnlyList<SqlScript> LoadScripts(string migrationsPath, string adminPasswordHash)
{
    var scripts = new List<SqlScript>();
    var adminPasswordHashExpression = ToPostgreSqlTextExpression(adminPasswordHash);

    foreach (var path in Directory
        .EnumerateFiles(migrationsPath, "*.sql", SearchOption.TopDirectoryOnly)
        .OrderBy(path => Path.GetFileName(path), StringComparer.Ordinal))
    {
        var contents = File.ReadAllText(path);

        if (contents.Contains(AdminPasswordHashToken, StringComparison.Ordinal))
        {
            contents = contents.Replace(
                AdminPasswordHashToken,
                adminPasswordHashExpression,
                StringComparison.Ordinal);
        }

        scripts.Add(new SqlScript(Path.GetFileName(path), contents));
    }

    return scripts;
}

static string ToPostgreSqlTextExpression(string value)
{
    var base64Value = Convert.ToBase64String(System.Text.Encoding.UTF8.GetBytes(value));
    return $"convert_from(decode('{base64Value}', 'base64'), 'UTF8')";
}
