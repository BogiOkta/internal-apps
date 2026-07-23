using DotNetEnv;
using Npgsql;

try
{
    var envPath = Path.Combine(Directory.GetCurrentDirectory(), ".env");
    if (!File.Exists(envPath))
    {
        return Fail();
    }

    Env.NoClobber().Load(envPath);

    var initialPassword = GetRequired("ADMIN_INITIAL_PASSWORD");
    if (string.Equals(
            initialPassword,
            "change_me_before_migration",
            StringComparison.Ordinal))
    {
        return Fail();
    }

    var connectionString = BuildOwnerConnectionString();
    var passwordHash = BCrypt.Net.BCrypt.HashPassword(initialPassword, workFactor: 12);

    await using var connection = new NpgsqlConnection(connectionString);
    await connection.OpenAsync();

    const string sql = """
        UPDATE identity.users
        SET password_hash = @password_hash,
            updated_at = now(),
            updated_by = id
        WHERE username = 'admin'
        """;

    await using var command = new NpgsqlCommand(sql, connection);
    command.Parameters.AddWithValue("password_hash", passwordHash);

    var affectedRows = await command.ExecuteNonQueryAsync();
    if (affectedRows != 1)
    {
        return Fail();
    }

    Console.WriteLine("Success.");
    return 0;
}
catch
{
    return Fail();
}

static string BuildOwnerConnectionString()
{
    var portValue = GetRequired("DB_PORT");
    if (!int.TryParse(portValue, out var port) || port is < 1 or > 65535)
    {
        throw new InvalidOperationException();
    }

    var sslModeValue = GetRequired("DB_SSL_MODE");
    if (!Enum.TryParse<SslMode>(sslModeValue, true, out var sslMode) ||
        !Enum.IsDefined(sslMode))
    {
        throw new InvalidOperationException();
    }

    var trustValue = GetRequired("DB_TRUST_SERVER_CERTIFICATE");
    if (!bool.TryParse(trustValue, out var trustServerCertificate))
    {
        throw new InvalidOperationException();
    }

    var builder = new NpgsqlConnectionStringBuilder
    {
        Host = GetRequired("DB_HOST"),
        Port = port,
        Database = GetRequired("DB_NAME"),
        Username = GetRequired("DB_OWNER_USER"),
        Password = GetRequired("DB_OWNER_PASSWORD"),
        SslMode = sslMode,
        ApplicationName = "InternalApps.AdminReset",
        IncludeErrorDetail = false,
        PersistSecurityInfo = false
    };
    builder["Trust Server Certificate"] = trustServerCertificate;

    return builder.ConnectionString;
}

static string GetRequired(string name)
{
    var value = Environment.GetEnvironmentVariable(name);
    return string.IsNullOrWhiteSpace(value)
        ? throw new InvalidOperationException()
        : value;
}

static int Fail()
{
    Console.Error.WriteLine("Failure.");
    return 1;
}
