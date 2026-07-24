using System.Data;
using Dapper;
using Npgsql;
using NpgsqlTypes;

namespace InternalApps.Api.Infrastructure;

internal sealed class DateOnlyTypeHandler : SqlMapper.TypeHandler<DateOnly>
{
    public override void SetValue(IDbDataParameter parameter, DateOnly value)
    {
        parameter.Value = value;
        if (parameter is NpgsqlParameter npgsqlParameter)
            npgsqlParameter.NpgsqlDbType = NpgsqlDbType.Date;
    }

    public override DateOnly Parse(object value) =>
        value switch
        {
            DateOnly date => date,
            DateTime dateTime => DateOnly.FromDateTime(dateTime),
            _ => throw new DataException(
                $"Cannot convert {value.GetType().Name} to DateOnly.")
        };
}
